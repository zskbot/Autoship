import React, { useState } from 'react';
import { 
  X, 
  Plus, 
  Trash2, 
  Server, 
  GitBranch, 
  Folder, 
  Sliders, 
  Shield, 
  Play,
  Layers
} from 'lucide-react';
import { DeploymentProject, DeploymentTarget } from '../types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveProject: (projectData: Partial<DeploymentProject>) => Promise<void>;
  initialProject?: DeploymentProject | null;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSaveProject,
  initialProject,
}) => {
  const [name, setName] = useState(initialProject?.name || '');
  const [repoUrl, setRepoUrl] = useState(initialProject?.repoUrl || '');
  const [branch, setBranch] = useState(initialProject?.branch || 'main');
  const [target, setTarget] = useState<DeploymentTarget>(initialProject?.target || 'vps-ssh');
  const [serverIp, setServerIp] = useState(initialProject?.serverIp || '');
  const [serverPort, setServerPort] = useState(initialProject?.serverPort || 22);
  const [serverUser, setServerUser] = useState(initialProject?.serverUser || 'root');
  const [deployPath, setDeployPath] = useState(initialProject?.deployPath || '/var/www/my-app');
  const [framework, setFramework] = useState(initialProject?.framework || 'react-vite');
  const [buildCommand, setBuildCommand] = useState(initialProject?.buildCommand || 'npm ci && npm run build');
  const [startCommand, setStartCommand] = useState(initialProject?.startCommand || 'pm2 reload all || systemctl reload nginx');
  const [autoDeployOnPush, setAutoDeployOnPush] = useState(initialProject?.autoDeployOnPush !== false);
  const [envVariables, setEnvVariables] = useState(initialProject?.envVariables || [
    { key: 'NODE_ENV', value: 'production', isSecret: false }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFrameworkChange = (selected: string) => {
    setFramework(selected as any);
    if (selected === 'react-vite') {
      setBuildCommand('npm ci && npm run build');
      setStartCommand('systemctl reload nginx');
    } else if (selected === 'nextjs') {
      setBuildCommand('npm ci && npm run build');
      setStartCommand('pm2 reload next-app || pm2 start npm --name next-app -- start');
    } else if (selected === 'nodejs-express') {
      setBuildCommand('npm ci');
      setStartCommand('pm2 reload api-server || pm2 start index.js --name api-server');
    } else if (selected === 'docker-compose') {
      setBuildCommand('docker compose build');
      setStartCommand('docker compose up -d --remove-orphans');
      setTarget('docker');
    } else if (selected === 'python-fastapi') {
      setBuildCommand('pip install -r requirements.txt');
      setStartCommand('systemctl restart fastapi');
    }
  };

  const handleAddEnv = () => {
    setEnvVariables([...envVariables, { key: '', value: '', isSecret: false }]);
  };

  const handleRemoveEnv = (index: number) => {
    setEnvVariables(envVariables.filter((_, i) => i !== index));
  };

  const handleEnvChange = (index: number, field: 'key' | 'value' | 'isSecret', val: any) => {
    const next = [...envVariables];
    next[index] = { ...next[index], [field]: val };
    setEnvVariables(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !repoUrl) return;

    setIsSubmitting(true);
    try {
      await onSaveProject({
        name,
        repoUrl,
        branch,
        target,
        serverIp,
        serverPort: Number(serverPort),
        serverUser,
        deployPath,
        framework: framework as any,
        buildCommand,
        startCommand,
        autoDeployOnPush,
        envVariables: envVariables.filter((ev) => ev.key.trim() !== ''),
      });
      onClose();
    } catch (err) {
      console.error('Error saving project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Modal Header */}
        <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-600/20 text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {initialProject ? 'Chỉnh Sửa Dự Án Deploy' : 'Thêm Dự Án GitHub Mới'}
              </h3>
              <p className="text-xs text-slate-400">Cấu hình kết nối repository và máy chủ tự động hóa</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* General info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Tên Dự Án *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: My Web App"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Framework / Tech Stack</label>
              <select
                value={framework}
                onChange={(e) => handleFrameworkChange(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="react-vite">React + Vite (SPA)</option>
                <option value="nextjs">Next.js (SSR / Static)</option>
                <option value="nodejs-express">Node.js + Express</option>
                <option value="docker-compose">Docker Compose Container</option>
                <option value="python-fastapi">Python FastAPI / Django</option>
                <option value="static-html">Static HTML/CSS/JS</option>
                <option value="custom">Tùy Chỉnh (Custom)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">GitHub Repo URL *</label>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/username/repository"
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Branch Theo Dõi</label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200">
                <GitBranch className="w-3.5 h-3.5 text-indigo-400 mr-2" />
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  required
                  className="bg-transparent text-xs text-white focus:outline-none w-full font-mono"
                />
              </div>
            </div>
          </div>

          {/* Deployment Target & Server */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <Server className="w-4 h-4" />
              <span>Cấu Hình Máy Chủ Đích (Target Server)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">IP Máy Chủ / Domain</label>
                <input
                  type="text"
                  value={serverIp}
                  onChange={(e) => setServerIp(e.target.value)}
                  placeholder="159.65.132.84"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">SSH User</label>
                <input
                  type="text"
                  value={serverUser}
                  onChange={(e) => setServerUser(e.target.value)}
                  placeholder="root hoặc deployer"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Thư Mục Deploy Trên Server</label>
                <input
                  type="text"
                  value={deployPath}
                  onChange={(e) => setDeployPath(e.target.value)}
                  placeholder="/var/www/my-web-app"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Commands */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <Sliders className="w-4 h-4" />
              <span>Lệnh Build & Khởi Động (Commands)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Lệnh Build</label>
                <input
                  type="text"
                  value={buildCommand}
                  onChange={(e) => setBuildCommand(e.target.value)}
                  placeholder="npm ci && npm run build"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-cyan-300 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Lệnh Reload / Start</label>
                <input
                  type="text"
                  value={startCommand}
                  onChange={(e) => setStartCommand(e.target.value)}
                  placeholder="pm2 reload all"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-cyan-300 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Environment variables */}
          <div className="pt-2 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                <Shield className="w-4 h-4" />
                <span>Biến Môi Trường & Secrets (ENV)</span>
              </div>
              <button
                type="button"
                onClick={handleAddEnv}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm Biến</span>
              </button>
            </div>

            <div className="space-y-2">
              {envVariables.map((ev, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="KEY (VD: VITE_API_URL)"
                    value={ev.key}
                    onChange={(e) => handleEnvChange(index, 'key', e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                  <input
                    type={ev.isSecret ? 'password' : 'text'}
                    placeholder="VALUE"
                    value={ev.value}
                    onChange={(e) => handleEnvChange(index, 'value', e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                  <label className="flex items-center gap-1 text-[11px] text-slate-400 select-none cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ev.isSecret}
                      onChange={(e) => handleEnvChange(index, 'isSecret', e.target.checked)}
                      className="rounded bg-slate-950 border-slate-700 text-indigo-500"
                    />
                    <span>Secret</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemoveEnv(index)}
                    className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Auto deploy toggle */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Tự động hóa kích hoạt khi Push Code</div>
              <div className="text-[11px] text-slate-400">Mỗi khi có commit mới vào branch theo dõi, tự động chạy build & deploy</div>
            </div>
            <input
              type="checkbox"
              checked={autoDeployOnPush}
              onChange={(e) => setAutoDeployOnPush(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 bg-slate-950 border-slate-700 focus:ring-0 cursor-pointer"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/25 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Đang lưu...' : initialProject ? 'Cập Nhật Cấu Hình' : 'Khởi Tạo Dự Án'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
