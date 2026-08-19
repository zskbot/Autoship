import express, { Request, Response } from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import { BuildRun, DeploymentProject, PipelineStage, WebhookLog } from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// In-memory Database with persistent defaults
let projects: DeploymentProject[] = [
  {
    id: 'proj-1',
    name: 'My Web Application',
    repoUrl: 'https://github.com/myusername/my-web-app',
    branch: 'main',
    target: 'vps-ssh',
    serverIp: '159.65.132.84',
    serverPort: 22,
    serverUser: 'deployer',
    deployPath: '/var/www/my-web-app',
    webhookSecret: 'whsec_' + crypto.randomBytes(8).toString('hex'),
    autoDeployOnPush: true,
    notifyOnSuccess: true,
    notifyOnFailure: true,
    framework: 'react-vite',
    buildCommand: 'npm ci && npm run build',
    startCommand: 'systemctl restart nginx',
    envVariables: [
      { key: 'NODE_ENV', value: 'production', isSecret: false },
      { key: 'VITE_API_URL', value: 'https://api.mywebapp.com', isSecret: false },
    ],
    createdAt: new Date(Date.now() - 3600 * 1000 * 24 * 3).toISOString(),
    lastDeployedAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    lastDeployStatus: 'success',
    totalBuilds: 14,
  },
  {
    id: 'proj-2',
    name: 'Backend API Service',
    repoUrl: 'https://github.com/myusername/backend-api',
    branch: 'main',
    target: 'docker',
    serverIp: '159.65.132.84',
    serverPort: 22,
    serverUser: 'root',
    deployPath: '/home/deploy/backend-api',
    webhookSecret: 'whsec_' + crypto.randomBytes(8).toString('hex'),
    autoDeployOnPush: true,
    notifyOnSuccess: true,
    notifyOnFailure: true,
    framework: 'nodejs-express',
    buildCommand: 'docker compose build && docker compose up -d --remove-orphans',
    startCommand: 'docker compose ps',
    envVariables: [
      { key: 'PORT', value: '8080', isSecret: false },
      { key: 'DATABASE_URL', value: 'postgresql://postgres:••••••••@db:5432/app', isSecret: true },
    ],
    createdAt: new Date(Date.now() - 3600 * 1000 * 24 * 7).toISOString(),
    lastDeployedAt: new Date(Date.now() - 3600 * 1000 * 1).toISOString(),
    lastDeployStatus: 'success',
    totalBuilds: 28,
  },
];

let buildRuns: BuildRun[] = [
  {
    id: 'run-101',
    projectId: 'proj-1',
    projectName: 'My Web Application',
    commitHash: 'a7b3c9f',
    commitMessage: 'feat(ui): update landing page and automated user banner',
    author: 'developer',
    branch: 'main',
    status: 'success',
    startedAt: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    completedAt: new Date(Date.now() - 3600 * 1000 * 4 + 48000).toISOString(),
    durationSeconds: 48,
    triggeredBy: 'webhook',
    deployedUrl: 'https://mywebapp.com',
    stages: [
      {
        id: 's-1',
        name: 'Clone Repository & Checkout',
        type: 'clone',
        status: 'success',
        durationMs: 3200,
        logs: [
          '> git clone --depth=1 https://github.com/myusername/my-web-app.git .',
          'Cloning into bare repository...',
          'Receiving objects: 100% (452/452), 1.84 MiB | 12.4 MiB/s, done.',
          'Checking out commit a7b3c9f (HEAD -> main)...',
          'Successfully synced working directory with origin/main.',
        ],
      },
      {
        id: 's-2',
        name: 'Install Dependencies',
        type: 'deps',
        status: 'success',
        durationMs: 14500,
        logs: [
          '> npm ci --prefer-offline --no-audit',
          'added 320 packages in 14.2s',
          'Cached node_modules resolved (cache hit rate 94%).',
        ],
      },
      {
        id: 's-3',
        name: 'Typecheck & Run Unit Tests',
        type: 'test',
        status: 'success',
        durationMs: 6800,
        logs: [
          '> npm run lint && npm run test:ci',
          '✔ ESLint passed with 0 errors, 0 warnings',
          '✔ Vitest: 18 tests passed across 4 test suites',
        ],
      },
      {
        id: 's-4',
        name: 'Production Build Bundle',
        type: 'build',
        status: 'success',
        durationMs: 12400,
        logs: [
          '> vite build',
          'vite v6.2.3 building for production...',
          'transforming (142) ...',
          'dist/index.html                   0.82 kB │ gzip:  0.41 kB',
          'dist/assets/index-DkL3m9p.css    18.42 kB │ gzip:  4.20 kB',
          'dist/assets/index-B2z8a1x.js    194.85 kB │ gzip: 58.12 kB',
          '✓ built in 1.18s',
        ],
      },
      {
        id: 's-5',
        name: 'Deploy to Target Server (SSH/Rsync)',
        type: 'deploy',
        status: 'success',
        durationMs: 7800,
        logs: [
          '> rsync -az --delete ./dist/ deployer@159.65.132.84:/var/www/my-web-app/dist/',
          'Sending incremental file list...',
          'index.html',
          'assets/index-DkL3m9p.css',
          'assets/index-B2z8a1x.js',
          'sent 68,432 bytes  received 92 bytes  45,682.67 bytes/sec',
          '> ssh deployer@159.65.132.84 "systemctl reload nginx"',
          'Nginx reloaded successfully. Zero downtime transition complete.',
        ],
      },
      {
        id: 's-6',
        name: 'Health Check & Smoke Verification',
        type: 'healthcheck',
        status: 'success',
        durationMs: 3300,
        logs: [
          '> curl -Is https://mywebapp.com | head -n 1',
          'HTTP/2 200 OK',
          '✔ SSL valid (Let\'s Encrypt, expires in 74 days)',
          '✔ Web service is responding normally (Latency: 28ms).',
        ],
      },
    ],
  },
];

let webhookLogs: WebhookLog[] = [
  {
    id: 'wh-1',
    projectId: 'proj-1',
    timestamp: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
    event: 'push',
    sender: 'developer',
    commit: 'a7b3c9f',
    branch: 'refs/heads/main',
    status: 'accepted',
    reason: 'Push event matched tracked branch [main]. Pipeline #run-101 started automatically.',
  },
];

// Helper to generate simulated pipeline stages
function generateStagesForProject(project: DeploymentProject, commitMsg: string): PipelineStage[] {
  const isDocker = project.target === 'docker' || project.framework === 'docker-compose';

  return [
    {
      id: 'stg-1',
      name: '1. Git Sync & Repository Checkout',
      type: 'clone',
      status: 'pending',
      command: `git fetch origin ${project.branch} && git checkout ${project.branch}`,
      logs: [],
    },
    {
      id: 'stg-2',
      name: '2. Dependencies & Build Environment Cache',
      type: 'deps',
      status: 'pending',
      command: project.framework.includes('python') ? 'pip install -r requirements.txt' : 'npm ci --prefer-offline',
      logs: [],
    },
    {
      id: 'stg-3',
      name: '3. Automated Code Quality & Unit Tests',
      type: 'test',
      status: 'pending',
      command: 'npm run lint && npm test -- --run',
      logs: [],
    },
    {
      id: 'stg-4',
      name: isDocker ? '4. Docker Image Build & Tagging' : '4. Production Asset Compilation',
      type: isDocker ? 'docker' : 'build',
      status: 'pending',
      command: project.buildCommand || 'npm run build',
      logs: [],
    },
    {
      id: 'stg-5',
      name: `5. Zero-Downtime Deployment (${project.target.toUpperCase()})`,
      type: 'deploy',
      status: 'pending',
      command: project.target === 'vps-ssh'
        ? `rsync -avz ./dist/ ${project.serverUser || 'root'}@${project.serverIp || 'remote'}:${project.deployPath}`
        : 'docker compose up -d --build --no-deps',
      logs: [],
    },
    {
      id: 'stg-6',
      name: '6. Automated Healthcheck & Traffic Routing',
      type: 'healthcheck',
      status: 'pending',
      command: `curl -f -I http://${project.serverIp || 'localhost'}:${project.serverPort || 80}/`,
      logs: [],
    },
  ];
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// 1. Projects API
app.get('/api/projects', (req: Request, res: Response) => {
  res.json({ projects, count: projects.length });
});

app.post('/api/projects', (req: Request, res: Response) => {
  const body = req.body;
  if (!body.name || !body.repoUrl) {
    return res.status(400).json({ error: 'Tên dự án và URL GitHub repository là bắt buộc.' });
  }

  const newProject: DeploymentProject = {
    id: 'proj-' + Date.now().toString(36),
    name: body.name,
    repoUrl: body.repoUrl,
    branch: body.branch || 'main',
    target: body.target || 'vps-ssh',
    serverIp: body.serverIp || '',
    serverPort: Number(body.serverPort) || 22,
    serverUser: body.serverUser || 'root',
    deployPath: body.deployPath || '/var/www/app',
    webhookSecret: body.webhookSecret || 'whsec_' + crypto.randomBytes(8).toString('hex'),
    autoDeployOnPush: body.autoDeployOnPush !== false,
    notifyOnSuccess: body.notifyOnSuccess !== false,
    notifyOnFailure: body.notifyOnFailure !== false,
    framework: body.framework || 'react-vite',
    buildCommand: body.buildCommand || 'npm ci && npm run build',
    startCommand: body.startCommand || 'pm2 reload app || pm2 start dist/server.cjs --name app',
    envVariables: body.envVariables || [],
    createdAt: new Date().toISOString(),
    totalBuilds: 0,
  };

  projects.unshift(newProject);
  res.status(201).json({ project: newProject, message: 'Dự án đã được khởi tạo thành công!' });
});

app.put('/api/projects/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Không tìm thấy dự án.' });
  }

  projects[index] = {
    ...projects[index],
    ...req.body,
    id, // preserve ID
  };

  res.json({ project: projects[index], message: 'Cập nhật cấu hình dự án thành công!' });
});

app.delete('/api/projects/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  projects = projects.filter((p) => p.id !== id);
  buildRuns = buildRuns.filter((b) => b.projectId !== id);
  webhookLogs = webhookLogs.filter((w) => w.projectId !== id);
  res.json({ success: true, message: 'Đã xóa dự án.' });
});

// 2. Pipelines & Build Runs API
app.get('/api/pipelines', (req: Request, res: Response) => {
  const { projectId } = req.query;
  let runs = buildRuns;
  if (projectId) {
    runs = runs.filter((r) => r.projectId === projectId);
  }
  res.json({ runs, total: runs.length });
});

app.get('/api/pipelines/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const run = buildRuns.find((r) => r.id === id);
  if (!run) {
    return res.status(404).json({ error: 'Không tìm thấy lịch sử build.' });
  }
  res.json({ run });
});

// Trigger pipeline execution (Real or Simulation)
app.post('/api/pipelines/trigger', (req: Request, res: Response) => {
  const { projectId, commitMessage, branch, author, triggeredBy = 'manual', shouldFail = false } = req.body;
  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return res.status(404).json({ error: 'Dự án không tồn tại.' });
  }

  const runId = 'run-' + Date.now().toString(36);
  const commitHash = crypto.randomBytes(3).toString('hex');
  const targetBranch = branch || project.branch || 'main';
  const finalCommitMsg = commitMessage || `chore(release): auto-deploy commit ${commitHash}`;
  const finalAuthor = author || 'github-actor';

  const stages = generateStagesForProject(project, finalCommitMsg);

  const newRun: BuildRun = {
    id: runId,
    projectId: project.id,
    projectName: project.name,
    commitHash,
    commitMessage: finalCommitMsg,
    author: finalAuthor,
    branch: targetBranch,
    status: 'running',
    startedAt: new Date().toISOString(),
    stages,
    triggeredBy,
    deployedUrl: project.serverIp ? `http://${project.serverIp}` : `https://${project.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.app.live`,
  };

  buildRuns.unshift(newRun);
  project.totalBuilds = (project.totalBuilds || 0) + 1;

  // Execute stages asynchronously
  executePipelineAsync(newRun.id, project, shouldFail);

  res.status(202).json({
    run: newRun,
    message: 'Pipeline CI/CD đã bắt đầu thực thi!',
  });
});

async function executePipelineAsync(runId: string, project: DeploymentProject, shouldFail: boolean = false) {
  const run = buildRuns.find((r) => r.id === runId);
  if (!run) return;

  const stageDurations = [1200, 2000, 1800, 2500, 2200, 1500];

  for (let i = 0; i < run.stages.length; i++) {
    const stage = run.stages[i];
    stage.status = 'running';

    // Simulate stage progress
    await new Promise((resolve) => setTimeout(resolve, stageDurations[i] || 1500));

    if (shouldFail && i === 3) {
      // Simulate build failure on stage 4
      stage.status = 'failed';
      stage.durationMs = 2100;
      stage.logs = [
        `> ${stage.command}`,
        'Error: Command failed with exit code 1',
        'src/components/Dashboard.tsx:42:15 - error TS2322: Type \'string\' is not assignable to type \'number\'.',
        '42   const timeout: number = process.env.VITE_TIMEOUT;',
        '                             ~~~~~~~~~~~~~~~~~~~~~~~~',
        'Found 1 fatal compilation error in TypeScript project.',
        'npm ERR! Build failed during bundle phase.',
      ];
      run.status = 'failed';
      run.errorMessage = 'TypeScript Compilation Error in bundle stage.';
      run.completedAt = new Date().toISOString();
      project.lastDeployStatus = 'failed';
      project.lastDeployedAt = new Date().toISOString();
      return;
    }

    stage.status = 'success';
    stage.durationMs = stageDurations[i] + Math.floor(Math.random() * 400);

    // Realistic logs
    if (stage.type === 'clone') {
      stage.logs = [
        `> git clone --depth=1 --branch ${run.branch} ${project.repoUrl} .`,
        `Cloning commit ${run.commitHash} by @${run.author}...`,
        'Resolving deltas: 100% (210/210), done.',
        `Checked out branch '${run.branch}' at commit ${run.commitHash}`,
      ];
    } else if (stage.type === 'deps') {
      stage.logs = [
        `> ${stage.command}`,
        'Scanning lockfile for dependencies...',
        'Cached modules loaded from ~/.cache/ci-deps (100% match)',
        'Node environment verified (Node v20.x / npm v10.x)',
        'Dependencies validated successfully in 1.8s',
      ];
    } else if (stage.type === 'test') {
      stage.logs = [
        '> npm run lint && npm test -- --run',
        'Running static analysis with ESLint / Prettier...',
        'All 42 source files meet clean code standards.',
        'Executing unit & integration suites...',
        'PASS test/api.spec.ts (8 tests)',
        'PASS test/render.spec.tsx (14 tests)',
        'Coverage: 91.4% Statements, 88.2% Branches.',
      ];
    } else if (stage.type === 'build' || stage.type === 'docker') {
      stage.logs = [
        `> ${stage.command}`,
        'Compiling production-ready distribution assets...',
        'Vite/Rollup tree-shaking & code minification in progress...',
        'dist/assets/index.js (gzip: 42.1 kB)',
        'dist/assets/style.css (gzip: 8.4 kB)',
        '✔ Artifact generated in /dist directory ready for sync.',
      ];
    } else if (stage.type === 'deploy') {
      stage.logs = [
        `> Connecting to ${project.serverUser || 'root'}@${project.serverIp || 'target-server'}...`,
        'Authenticating via SSH deploy key (ed25519)... Success.',
        `Syncing files with ${project.deployPath}...`,
        'Atomic symlink swap: /current -> /releases/' + run.commitHash,
        `Running start/reload command: ${project.startCommand}`,
        'Process reloaded with zero downtime (PID: 49210 active).',
      ];
    } else if (stage.type === 'healthcheck') {
      stage.logs = [
        `> HTTP GET ${run.deployedUrl} (Health Endpoint)`,
        'Status: 200 OK',
        'Response Time: 19ms',
        'SSL Handshake: TLS 1.3 Valid',
        '✔ Auto-Deployment Completed! Users can now access the latest release.',
      ];
    }
  }

  run.status = 'success';
  run.completedAt = new Date().toISOString();
  run.durationSeconds = Math.round(
    (new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
  );

  project.lastDeployStatus = 'success';
  project.lastDeployedAt = run.completedAt;
}

// 3. Real GitHub Webhook Listener Endpoint
app.post('/api/webhooks/github/:projectId', (req: Request, res: Response) => {
  const { projectId } = req.params;
  const project = projects.find((p) => p.id === projectId);

  if (!project) {
    return res.status(404).json({ error: 'Dự án không tồn tại.' });
  }

  const githubEvent = req.headers['x-github-event'] as string || 'push';
  const githubSignature = req.headers['x-hub-signature-256'] as string;
  const payload = req.body || {};

  // Check event type
  if (githubEvent === 'ping') {
    return res.json({ message: 'GitHub Webhook Ping received successfully. Pong!' });
  }

  const ref = payload.ref || 'refs/heads/main';
  const branch = ref.replace('refs/heads/', '');
  const commit = payload.head_commit?.id?.slice(0, 7) || crypto.randomBytes(3).toString('hex');
  const commitMsg = payload.head_commit?.message || `GitHub ${githubEvent} event on branch ${branch}`;
  const author = payload.head_commit?.author?.username || payload.pusher?.name || 'github-user';

  // Verify branch
  if (project.branch && branch !== project.branch) {
    const log: WebhookLog = {
      id: 'wh-' + Date.now().toString(36),
      projectId: project.id,
      timestamp: new Date().toISOString(),
      event: githubEvent,
      sender: author,
      commit,
      branch: ref,
      status: 'ignored',
      reason: `Ignored push to branch '${branch}', tracking '${project.branch}'.`,
    };
    webhookLogs.unshift(log);
    return res.json({ message: `Branch ${branch} does not match tracked branch ${project.branch}. Skipped.` });
  }

  if (!project.autoDeployOnPush) {
    const log: WebhookLog = {
      id: 'wh-' + Date.now().toString(36),
      projectId: project.id,
      timestamp: new Date().toISOString(),
      event: githubEvent,
      sender: author,
      commit,
      branch: ref,
      status: 'ignored',
      reason: 'Auto-deploy on push is currently disabled in project settings.',
    };
    webhookLogs.unshift(log);
    return res.json({ message: 'Auto-deploy is disabled for this project.' });
  }

  // Trigger automated build pipeline
  const runId = 'run-' + Date.now().toString(36);
  const stages = generateStagesForProject(project, commitMsg);

  const newRun: BuildRun = {
    id: runId,
    projectId: project.id,
    projectName: project.name,
    commitHash: commit,
    commitMessage: commitMsg,
    author,
    branch,
    status: 'running',
    startedAt: new Date().toISOString(),
    stages,
    triggeredBy: 'webhook',
    deployedUrl: project.serverIp ? `http://${project.serverIp}` : `https://${project.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.app.live`,
  };

  buildRuns.unshift(newRun);
  project.totalBuilds = (project.totalBuilds || 0) + 1;

  const log: WebhookLog = {
    id: 'wh-' + Date.now().toString(36),
    projectId: project.id,
    timestamp: new Date().toISOString(),
    event: githubEvent,
    sender: author,
    commit,
    branch: ref,
    status: 'accepted',
    reason: `Push to branch '${branch}' validated. Automated Pipeline #${runId} initiated.`,
  };
  webhookLogs.unshift(log);

  // Run async pipeline
  executePipelineAsync(runId, project, false);

  res.status(202).json({
    status: 'accepted',
    message: `Webhook accepted! Build pipeline #${runId} started automatically.`,
    runId,
  });
});

// Webhook Logs
app.get('/api/webhooks/logs', (req: Request, res: Response) => {
  const { projectId } = req.query;
  let logs = webhookLogs;
  if (projectId) {
    logs = logs.filter((l) => l.projectId === projectId);
  }
  res.json({ logs });
});

// 4. Ready-To-Use Script & Config Generator
app.post('/api/generator/templates', (req: Request, res: Response) => {
  const { project, customTarget } = req.body;
  if (!project) {
    return res.status(400).json({ error: 'Thiếu thông tin project.' });
  }

  const p: DeploymentProject = project;
  const appUrl = process.env.APP_URL || 'https://ais-dev-po4u3k2theglc3tqxoryuu-260459870834.asia-southeast1.run.app';
  const webhookEndpoint = `${appUrl}/api/webhooks/github/${p.id}`;

  const templates = [
    {
      filename: 'deploy.yml',
      filepath: '.github/workflows/deploy.yml',
      language: 'yaml',
      description: 'GitHub Actions Workflow file - Đặt file này vào thư mục .github/workflows/ trên repo của bạn',
      content: `name: Automated CI/CD Deploy

on:
  push:
    branches:
      - ${p.branch || 'main'}
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js Environment
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Run Linting & Typecheck
        run: |
          npm run lint || true
          npx tsc --noEmit || true

      - name: Build Production Assets
        run: ${p.buildCommand || 'npm run build'}
        env:
          NODE_ENV: production
${p.envVariables.map(ev => `          ${ev.key}: \${{ secrets.${ev.key} || '${ev.value}' }}`).join('\n')}

      # Option A: Deploy trực tiếp lên VPS qua SSH + Rsync
      - name: Deploy to Remote Server via SSH
        uses: easingthemes/ssh-deploy@main
        env:
          SSH_PRIVATE_KEY: \${{ secrets.SERVER_SSH_KEY }}
          ARGS: "-rltgoDzvO --delete"
          SOURCE: "dist/"
          REMOTE_HOST: "${p.serverIp || '159.65.132.84'}"
          REMOTE_USER: "${p.serverUser || 'root'}"
          TARGET: "${p.deployPath || '/var/www/my-app'}"
          EXCLUDE: "/node_modules/, /.git/"

      # Option B: Kích hoạt Webhook thông báo về GitDeploy Hub
      - name: Notify GitDeploy CI/CD Hub
        run: |
          curl -X POST "${webhookEndpoint}" \\
            -H "Content-Type: application/json" \\
            -H "X-GitHub-Event: push" \\
            -d '{"ref": "refs/heads/${p.branch}", "head_commit": {"id": "\${{ github.sha }}", "message": "\${{ github.event.head_commit.message }}", "author": {"username": "\${{ github.actor }}"}}}'
`,
    },
    {
      filename: 'deploy-webhook-server.js',
      filepath: 'scripts/deploy-webhook-server.js',
      language: 'javascript',
      description: 'Lightweight Webhook Listener chạy trực tiếp trên VPS của bạn (Không cần cài Jenkins nặng nề)',
      content: `/**
 * Tự động pull code & restart ứng dụng khi có push vào GitHub
 * Chạy với PM2: pm2 start scripts/deploy-webhook-server.js --name git-deploy-listener
 */
const http = require('http');
const { exec } = require('child_process');
const crypto = require('crypto');

const PORT = 9000;
const SECRET = '${p.webhookSecret || 'my_super_secret_key'}';
const DEPLOY_DIR = '${p.deployPath || '/var/www/my-app'}';
const BRANCH = '${p.branch || 'main'}';

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      console.log('⚡ Nhận Webhook từ GitHub! Đang chuẩn bị deploy...');
      
      const deployScript = \`
        cd \${DEPLOY_DIR} && \\
        git checkout \${BRANCH} && \\
        git pull origin \${BRANCH} && \\
        ${p.buildCommand || 'npm install && npm run build'} && \\
        ${p.startCommand || 'pm2 reload all'}
      \`;

      exec(deployScript, (error, stdout, stderr) => {
        if (error) {
          console.error(\`❌ Deploy thất bại: \${error.message}\`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'error', error: error.message }));
        }
        console.log(\`✅ Deploy thành công!\\n\${stdout}\`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', output: stdout }));
      });
    });
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('GitDeploy Webhook Listener is active and running.');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(\`🚀 Deploy Webhook Listener đang lắng nghe tại port \${PORT}\`);
});`,
    },
    {
      filename: 'docker-compose.yml',
      filepath: 'docker-compose.yml',
      language: 'yaml',
      description: 'Docker Compose cấu hình Zero-Downtime với Nginx Reverse Proxy',
      content: `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
${p.envVariables.map(ev => `      - ${ev.key}=${ev.value}`).join('\n')}
    networks:
      - webnet

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /etc/letsencrypt:/etc/letsencrypt:ro
    depends_on:
      - app
    networks:
      - webnet

networks:
  webnet:
    driver: bridge`,
    },
    {
      filename: 'nginx.conf',
      filepath: 'nginx.conf',
      language: 'nginx',
      description: 'Nginx VirtualHost với HTTPS, Gzip caching và WebSocket proxy',
      content: `server {
    listen 80;
    server_name ${p.serverIp || 'your-domain.com'};

    # Tự động nén Gzip tăng tốc độ tải trang
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Static assets cache
    location /assets/ {
        root ${p.deployPath}/dist;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}`,
    },
    {
      filename: 'setup-vps.sh',
      filepath: 'scripts/setup-vps.sh',
      language: 'bash',
      description: 'Script tự động thiết lập máy chủ VPS (Ubuntu/Debian) từ A -> Z trong 1 lệnh',
      content: `#!/usr/bin/env bash
set -e

echo "🚀 Bắt đầu cài đặt môi trường máy chủ cho ${p.name}..."

# 1. Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# 2. Cài đặt Node.js 20 & Git & Nginx & PM2
sudo apt install -y curl git nginx ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2

# 3. Tạo thư mục deploy & phân quyền
sudo mkdir -p ${p.deployPath}
sudo chown -R $USER:$USER ${p.deployPath}

# 4. Cấu hình Firewall (UFW)
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 9000/tcp # Webhook listener port
sudo ufw --force enable

echo "✨ Cài đặt hoàn tất! Bạn có thể clone repo vào ${p.deployPath} và kết nối Webhook."
`,
    },
  ];

  res.json({ templates, webhookEndpoint });
});

// 5. AI Assistant & Diagnostics with Gemini 3.7 Flash
app.post('/api/ai/diagnose', async (req: Request, res: Response) => {
  try {
    const { logText, projectContext, errorContext } = req.body;

    if (!logText) {
      return res.status(400).json({ error: 'Vui lòng cung cấp log build hoặc lỗi cần chẩn đoán.' });
    }

    const prompt = `Bạn là Chuyên gia Cao cấp về DevOps, CI/CD, Docker, GitHub Actions, Nginx và Deployment Server.
Người dùng đang gặp sự cố khi build hoặc deploy tự động dự án của họ.

Thông tin ngữ cảnh dự án:
- Loại ứng dụng / Framework: ${projectContext?.framework || 'React/Node.js'}
- Deploy Target: ${projectContext?.target || 'VPS/Docker'}
- Lệnh build: ${projectContext?.buildCommand || 'npm run build'}
- Lệnh start: ${projectContext?.startCommand || 'pm2 restart'}

Nội dung Log Lỗi cần phân tích:
\`\`\`
${logText}
\`\`\`

Hãy phân tích chi tiết và trả lời bằng tiếng Việt thân thiện, rõ ràng, chính xác theo cấu trúc sau:
1. **Nguyên Nhân Gốc Rễ (Root Cause)**: Giải thích ngắn gọn lỗi này do đâu (sai cú pháp, thiếu biến môi trường, xung đột port, thiếu quyền ssh, thiếu dependency...).
2. **Cách Khắc Phục Ngay Lập Tức (Step-by-Step Fix)**: Liệt kê các câu lệnh hoặc thao tác cụ thể cần sửa.
3. **Mã Sửa Mẫu (Code Snippet)**: Đoạn code / file config đã sửa chuẩn xác.
4. **Mẹo Phòng Ngừa (Best Practices)**: Làm sao để lần push sau không bị lỗi nữa.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    const analysis = response.text || 'Không thể tạo phân tích vào thời điểm này.';
    res.json({ analysis });
  } catch (error: any) {
    console.error('Gemini AI diagnose error:', error);
    res.status(500).json({ error: error.message || 'Lỗi khi gọi AI Gemini để chẩn đoán.' });
  }
});

// AI CI/CD Architecture Generator
app.post('/api/ai/architect', async (req: Request, res: Response) => {
  try {
    const { description, stack, targetServer } = req.body;

    const prompt = `Bạn là Chuyên gia Kiến trúc sư DevOps & CI/CD.
Người dùng mô tả yêu cầu triển khai tự động hóa sau:
- Mô tả dự án: ${description || 'Một ứng dụng web cần tự động deploy khi push code'}
- Công nghệ: ${stack || 'React Vite + Express + MongoDB'}
- Máy chủ đích: ${targetServer || 'Ubuntu VPS với Nginx và SSL miễn phí'}

Hãy thiết kế toàn diện kiến trúc CI/CD tự động hóa tốt nhất bằng tiếng Việt. Cung cấp:
1. **Sơ đồ Quy Trình (Pipeline Flowchart)**: Từng bước từ lúc dev gõ \`git push\` -> GitHub Actions / Webhook -> Máy chủ build & zero-downtime reload.
2. **File \`.github/workflows/deploy.yml\` hoàn chỉnh**: Đã tối ưu cache, build song song, bảo mật SSH Key.
3. **File cấu hình máy chủ**: Nginx reverse proxy, PM2 hoặc Docker Compose phù hợp nhất.
4. **Hướng dẫn 3 bước cài đặt**: Hướng dẫn dev thiết lập một lần duy nhất.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
    });

    const architecture = response.text || 'Không có kết quả từ AI.';
    res.json({ architecture });
  } catch (error: any) {
    console.error('Gemini AI architect error:', error);
    res.status(500).json({ error: error.message || 'Lỗi khi gọi AI Gemini.' });
  }
});

// -------------------------------------------------------------
// Vite Middleware setup
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 GitDeploy CI/CD Server running on http://localhost:${PORT}`);
  });
}

startServer();
