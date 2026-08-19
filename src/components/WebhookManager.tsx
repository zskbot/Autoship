import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Copy, 
  Check, 
  Play, 
  Send, 
  Shield, 
  Clock, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  GitBranch,
  Terminal
} from 'lucide-react';
import { DeploymentProject, WebhookLog } from '../types';

interface WebhookManagerProps {
  project: DeploymentProject | null;
  onPipelineTriggered?: () => void;
}

export const WebhookManager: React.FC<WebhookManagerProps> = ({
  project,
  onPipelineTriggered,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);

  // Simulation form state
  const [simBranch, setSimBranch] = useState(project?.branch || 'main');
  const [simCommitMsg, setSimCommitMsg] = useState('feat: update landing page and fix responsive navbar');
  const [simAuthor, setSimAuthor] = useState('github-developer');
  const [simShouldFail, setSimShouldFail] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<string | null>(null);

  const appUrl = window.location.origin;
  const webhookUrl = project ? `${appUrl}/api/webhooks/github/${project.id}` : '';

  useEffect(() => {
    if (project) {
      setSimBranch(project.branch || 'main');
      fetchLogs();
    }
  }, [project]);

  const fetchLogs = async () => {
    if (!project) return;
    setIsLoadingLogs(true);
    try {
      const res = await fetch(`/api/webhooks/logs?projectId=${project.id}`);
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Error fetching webhook logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleCopy = (text: string, type: 'url' | 'secret') => {
    navigator.clipboard.writeText(text);
    if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  const handleSimulatePush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setIsSimulating(true);
    setSimulationResult(null);

    try {
      // Send real push payload to webhook endpoint
      const res = await fetch(`/api/webhooks/github/${project.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GitHub-Event': 'push',
          'X-Hub-Signature-256': 'sha256=simulated_valid_hmac',
        },
        body: JSON.stringify({
          ref: `refs/heads/${simBranch}`,
          head_commit: {
            id: Math.random().toString(36).substring(2, 9),
            message: simCommitMsg,
            author: { username: simAuthor },
          },
          pusher: { name: simAuthor },
          repository: {
            name: project.name,
            clone_url: project.repoUrl,
          },
        }),
      });

      const data = await res.json();
      setSimulationResult(data.message || 'Webhook đã gửi thành công!');
      fetchLogs();
      if (onPipelineTriggered) {
        onPipelineTriggered();
      }
    } catch (err: any) {
      setSimulationResult('Lỗi khi gửi webhook: ' + err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  if (!project) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800">
        Vui lòng chọn một dự án để quản lý Webhook.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Webhook Endpoint Config Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">GitHub Webhook Listener</h2>
              <p className="text-xs text-slate-400">
                Endpoint tự động nhận thông báo từ GitHub mỗi khi có sự kiện <code className="text-cyan-300 font-mono">push</code>
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Đang hoạt động (200 OK)
          </span>
        </div>

        {/* URL and Secret inputs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Payload URL (Nhập vào GitHub)</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={webhookUrl}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleCopy(webhookUrl, 'url')}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition shrink-0"
                title="Sao chép Payload URL"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Secret Token (Xác thực an toàn HMAC)</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={project.webhookSecret}
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-amber-300 select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleCopy(project.webhookSecret, 'secret')}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition shrink-0"
                title="Sao chép Secret Token"
              >
                {copiedSecret ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* GitHub settings note */}
        <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 text-xs text-slate-400 flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <strong>Cách cài đặt trên GitHub:</strong> Vào repository &gt; <strong>Settings</strong> &gt; <strong>Webhooks</strong> &gt; <strong>Add webhook</strong> &gt; Dán <strong>Payload URL</strong> ở trên, chọn Content type là <code className="text-slate-300 font-mono">application/json</code>, dán <strong>Secret</strong> và chọn <code className="text-slate-300 font-mono">Just the push event</code>.
          </div>
        </div>
      </div>

      {/* Interactive Git Push Simulator */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Giả Lập Sự Kiện "Git Push" (Test Trực Tiếp)</h3>
            <p className="text-xs text-slate-400">
              Kiểm tra quy trình tự động hóa mà không cần phải thực sự mở terminal gõ git push trên máy tính của bạn.
            </p>
          </div>
        </div>

        <form onSubmit={handleSimulatePush} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Branch Push</label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200">
                <GitBranch className="w-3.5 h-3.5 text-indigo-400 mr-2" />
                <input
                  type="text"
                  value={simBranch}
                  onChange={(e) => setSimBranch(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none w-full font-mono"
                  placeholder="main"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Commit Message</label>
              <input
                type="text"
                value={simCommitMsg}
                onChange={(e) => setSimCommitMsg(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                placeholder="feat: add new payment gateway"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400">Tác giả:</label>
              <input
                type="text"
                value={simAuthor}
                onChange={(e) => setSimAuthor(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-xs text-slate-300 font-mono w-36"
              />
            </div>

            <button
              type="submit"
              disabled={isSimulating}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-500 via-blue-600 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white shadow-lg shadow-indigo-500/20 transition disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
              <span>{isSimulating ? 'Đang gửi Webhook...' : 'Gửi Push Payload & Tự Động Build Ngay'}</span>
            </button>
          </div>
        </form>

        {simulationResult && (
          <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-indigo-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{simulationResult}</span>
          </div>
        )}
      </div>

      {/* Webhook History Logs */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-bold text-white">Lịch Sử Webhooks Đã Nhận</h4>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
              {logs.length} sự kiện
            </span>
          </div>

          <button
            onClick={fetchLogs}
            disabled={isLoadingLogs}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>

        <div className="divide-y divide-slate-800/80 max-h-72 overflow-y-auto">
          {logs.length > 0 ? (
            logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-800/30 transition text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        log.status === 'accepted'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : log.status === 'ignored'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {log.status}
                    </span>
                    <span className="font-mono text-slate-200">{log.branch}</span>
                    <span className="font-mono text-indigo-400 bg-indigo-950/60 px-1.5 py-0.5 rounded">
                      {log.commit}
                    </span>
                  </div>
                  <span className="text-slate-500 text-[11px]">
                    {new Date(log.timestamp).toLocaleTimeString()} {new Date(log.timestamp).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] pt-1">{log.reason || 'Event processed.'}</p>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              Chưa có sự kiện Webhook nào. Thử sử dụng form giả lập ở trên!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
