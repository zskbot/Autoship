export type DeploymentTarget = 'vps-ssh' | 'vps-webhook' | 'docker' | 'cloudrun' | 'static-server' | 'pm2';

export type PipelineStatus = 'idle' | 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

export type PipelineStageType = 'clone' | 'deps' | 'test' | 'build' | 'docker' | 'deploy' | 'healthcheck' | 'notify';

export interface PipelineStage {
  id: string;
  name: string;
  type: PipelineStageType;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  durationMs?: number;
  logs: string[];
  command?: string;
}

export interface DeploymentProject {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  target: DeploymentTarget;
  serverIp?: string;
  serverPort?: number;
  serverUser?: string;
  deployPath?: string;
  webhookSecret: string;
  autoDeployOnPush: boolean;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  framework: 'react-vite' | 'nextjs' | 'nodejs-express' | 'python-fastapi' | 'docker-compose' | 'static-html' | 'custom';
  buildCommand: string;
  startCommand: string;
  envVariables: Array<{ key: string; value: string; isSecret: boolean }>;
  createdAt: string;
  lastDeployedAt?: string;
  lastDeployStatus?: PipelineStatus;
  totalBuilds: number;
}

export interface BuildRun {
  id: string;
  projectId: string;
  projectName: string;
  commitHash: string;
  commitMessage: string;
  author: string;
  branch: string;
  status: PipelineStatus;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  stages: PipelineStage[];
  triggeredBy: 'webhook' | 'manual' | 'retry' | 'schedule';
  deployedUrl?: string;
  errorMessage?: string;
}

export interface WebhookLog {
  id: string;
  projectId: string;
  timestamp: string;
  event: string;
  sender: string;
  commit: string;
  branch: string;
  status: 'accepted' | 'ignored' | 'rejected';
  reason?: string;
  payloadSummary?: any;
}

export interface GeneratedConfigTemplate {
  filename: string;
  filepath: string;
  language: string;
  description: string;
  content: string;
}
