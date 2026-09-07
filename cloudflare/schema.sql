CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  repo_url TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  target TEXT NOT NULL DEFAULT 'cloudflare-pages',
  framework TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  status TEXT NOT NULL,
  commit_hash TEXT,
  branch TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  message TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_runs_project_created ON runs(project_id, created_at DESC);
