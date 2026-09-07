interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

export interface Env {
  DB: D1Database;
  AUTOSHIP_PUBLIC_REPO: string;
  AUTOSHIP_API_TOKEN?: string;
  AUTOSHIP_GITHUB_TOKEN?: string;
  AUTOSHIP_ALLOWED_ORIGINS?: string;
}

type Row = Record<string, any>;
const projectView = (p: Row) => ({ id: p.id, name: p.name, repoUrl: p.repo_url, branch: p.branch, target: p.target, framework: p.framework, autoDeployOnPush: true, lastDeployStatus: p.last_deploy_status, totalBuilds: p.total_builds });
const runView = (r: Row) => ({ id: r.id, projectId: r.project_id, status: r.status, commitHash: r.commit_hash, commitMessage: r.commit_message || r.message || "", branch: r.branch, triggeredBy: r.triggered_by || "autoship", deployedUrl: r.deployed_url, startedAt: r.started_at || r.created_at, completedAt: r.completed_at, errorMessage: r.error_message });
const json = (data: unknown, status = 200, origin = "*") => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": origin, "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS", "cache-control": "no-store" } });
function requestOrigin(request: Request, env: Env) { const configured = (env.AUTOSHIP_ALLOWED_ORIGINS || "").split(",").map((v) => v.trim()).filter(Boolean); const origin = request.headers.get("origin") || ""; return configured.includes(origin) ? origin : configured[0] || "*"; }
function authorized(request: Request, env: Env) { return !env.AUTOSHIP_API_TOKEN || request.headers.get("authorization") === `Bearer ${env.AUTOSHIP_API_TOKEN}`; }
function id(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
function repoSlug(repoUrl: string) { const match = repoUrl.match(/github\.com\/([^/]+\/[^/#]+?)(?:\.git)?(?:[/#].*)?$/i); return match?.[1] || repoUrl; }

async function githubDispatch(env: Env, payload: Record<string, unknown>) {
  if (!env.AUTOSHIP_GITHUB_TOKEN) throw new Error("AUTOSHIP_GITHUB_TOKEN is not configured");
  const response = await fetch(`https://api.github.com/repos/${env.AUTOSHIP_PUBLIC_REPO}/dispatches`, { method: "POST", headers: { authorization: `Bearer ${env.AUTOSHIP_GITHUB_TOKEN}`, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "Autoship-Cloudflare-Worker", "x-github-api-version": "2022-11-28" }, body: JSON.stringify({ event_type: "autoship_deploy", client_payload: payload }) });
  if (!response.ok) throw new Error(`GitHub dispatch failed: ${response.status}`);
}

async function route(request: Request, env: Env) {
  const url = new URL(request.url), origin = requestOrigin(request, env);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS" } });
  if (url.pathname === "/api/health") return json({ ok: true, service: "autoship-control-plane", runtime: "cloudflare-workers" }, 200, origin);
  if (url.pathname === "/api/ready") { try { await env.DB.prepare("SELECT 1").first(); return json({ ok: true, database: "d1" }, 200, origin); } catch (error) { return json({ ok: false, error: String(error) }, 503, origin); } }

  const mutating = request.method !== "GET";
  if (mutating && !authorized(request, env)) return json({ error: "Unauthorized" }, 401, origin);

  if (url.pathname === "/api/deployments/callback" && request.method === "POST") {
    const body = await request.json<Record<string, unknown>>(), runId = String(body.runId || ""), status = String(body.status || "");
    if (!runId || !["queued", "running", "success", "failed", "cancelled"].includes(status)) return json({ error: "Invalid callback" }, 400, origin);
    await env.DB.prepare("UPDATE runs SET status=?, updated_at=?, message=? WHERE id=?").bind(status, new Date().toISOString(), body.message ? String(body.message) : null, runId).run();
    return json({ ok: true }, 200, origin);
  }

  if (url.pathname === "/api/projects" && request.method === "GET") { const rows = await env.DB.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all(); return json({ projects: rows.results.map(projectView) }, 200, origin); }
  if (url.pathname === "/api/projects/upsert" && request.method === "POST") {
    const body = await request.json<Record<string, unknown>>(), repoUrl = String(body.repoUrl || "").trim();
    if (!repoUrl) return json({ error: "repoUrl is required" }, 400, origin);
    const now = new Date().toISOString(), existing = await env.DB.prepare("SELECT * FROM projects WHERE repo_url=?").bind(repoUrl).first<Row>();
    const project = { id: existing?.id || id("project"), repo_url: repoUrl, name: String(body.name || existing?.name || repoUrl.split("/").pop() || "Project"), branch: String(body.branch || existing?.branch || "main"), target: String(body.target || existing?.target || "cloudflare-pages"), framework: body.framework ? String(body.framework) : (existing?.framework || null), created_at: existing?.created_at || now, updated_at: now };
    await env.DB.prepare(`INSERT INTO projects (id,repo_url,name,branch,target,framework,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(repo_url) DO UPDATE SET name=excluded.name,branch=excluded.branch,target=excluded.target,framework=excluded.framework,updated_at=excluded.updated_at`).bind(project.id, project.repo_url, project.name, project.branch, project.target, project.framework, project.created_at, project.updated_at).run();
    return json({ project: projectView(project) }, existing ? 200 : 201, origin);
  }
  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch && request.method === "DELETE") { await env.DB.prepare("DELETE FROM projects WHERE id=?").bind(projectMatch[1]).run(); return json({ ok: true }, 200, origin); }
  if (url.pathname === "/api/pipelines/trigger" && request.method === "POST") {
    const body = await request.json<Record<string, unknown>>(), projectId = String(body.projectId || ""), project = await env.DB.prepare("SELECT * FROM projects WHERE id=?").bind(projectId).first<Row>();
    if (!project) return json({ error: "Project not found" }, 404, origin);
    const runId = id("run"), now = new Date().toISOString(), commitHash = body.commitHash ? String(body.commitHash) : null, branch = String(body.branch || project.branch);
    const run = { id: runId, project_id: projectId, status: "queued", commit_hash: commitHash, branch, created_at: now, updated_at: now, message: "Queued for GitHub Actions", triggered_by: body.triggeredBy || "autoship" };
    await env.DB.prepare("INSERT INTO runs (id,project_id,status,commit_hash,branch,created_at,updated_at,message) VALUES (?,?,?,?,?,?,?,?)").bind(run.id, run.project_id, run.status, run.commit_hash, run.branch, run.created_at, run.updated_at, run.message).run();
    try { await githubDispatch(env, { runId, projectId, repoUrl: project.repo_url, repo: repoSlug(project.repo_url), branch, commitHash, target: project.target }); }
    catch (error) { await env.DB.prepare("UPDATE runs SET status='failed',updated_at=?,message=? WHERE id=?").bind(new Date().toISOString(), String(error), runId).run(); return json({ error: "Unable to dispatch GitHub Actions", run: runView({ ...run, status: "failed", message: String(error) }) }, 502, origin); }
    return json({ run: runView(run), message: "Pipeline queued in GitHub Actions" }, 202, origin);
  }
  const runMatch = url.pathname.match(/^\/api\/pipelines\/([^/]+)$/);
  if (runMatch && request.method === "GET") { const run = await env.DB.prepare("SELECT * FROM runs WHERE id=?").bind(runMatch[1]).first<Row>(); return run ? json({ run: runView(run) }, 200, origin) : json({ error: "Run not found" }, 404, origin); }
  return json({ error: "Not found" }, 404, origin);
}

export default { fetch: (request: Request, env: Env) => route(request, env) };
