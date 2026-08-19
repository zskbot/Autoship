import React from 'react';
import { 
  GitBranch, 
  Play, 
  Bot, 
  FileCode2, 
  Radio, 
  Plus, 
  Layers, 
  CheckCircle2, 
  Terminal,
  Activity
} from 'lucide-react';
import { DeploymentProject } from '../types';

interface HeaderProps {
  projects: DeploymentProject[];
  selectedProject: DeploymentProject | null;
  onSelectProject: (project: DeploymentProject) => void;
  activeTab: 'pipelines' | 'configs' | 'webhooks' | 'ai-doctor' | 'projects';
  onTabChange: (tab: 'pipelines' | 'configs' | 'webhooks' | 'ai-doctor' | 'projects') => void;
  onOpenNewProjectModal: () => void;
  onTriggerDeploy: () => void;
  isTriggering: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  projects,
  selectedProject,
  onSelectProject,
  activeTab,
  onTabChange,
  onOpenNewProjectModal,
  onTriggerDeploy,
  isTriggering,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Activity className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  GitDeploy Hub
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                  CI/CD Ready
                </span>
              </div>
              <p className="text-xs text-slate-400">Tự động hóa Build & Deploy từ GitHub</p>
            </div>
          </div>

          {/* Project Selector & Actions */}
          <div className="flex items-center gap-3">
            {projects.length > 0 && selectedProject && (
              <div className="relative">
                <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200">
                  <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                  <select
                    value={selectedProject.id}
                    onChange={(e) => {
                      const p = projects.find((proj) => proj.id === e.target.value);
                      if (p) onSelectProject(p);
                    }}
                    className="bg-transparent text-xs text-white font-medium focus:outline-none cursor-pointer pr-4"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                        {p.name} ({p.branch})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <button
              onClick={onOpenNewProjectModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Thêm dự án GitHub mới"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Dự Án</span>
            </button>

            <button
              onClick={onTriggerDeploy}
              disabled={isTriggering || !selectedProject}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white shadow-md shadow-indigo-500/25 transition disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${isTriggering ? 'animate-spin' : ''}`} />
              <span>{isTriggering ? 'Đang kích hoạt...' : 'Kích Hoạt Deploy'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 -mb-px overflow-x-auto no-scrollbar border-t border-slate-800/60 pt-1">
          <button
            onClick={() => onTabChange('pipelines')}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'pipelines'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Pipelines & Logs</span>
          </button>

          <button
            onClick={() => onTabChange('configs')}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'configs'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Bộ Cài Đặt & GitHub Actions</span>
          </button>

          <button
            onClick={() => onTabChange('webhooks')}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'webhooks'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>GitHub Webhook & Giả Lập Push</span>
          </button>

          <button
            onClick={() => onTabChange('ai-doctor')}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'ai-doctor'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-amber-400" />
            <span className="flex items-center gap-1.5">
              AI DevOps Bác Sĩ & Thiết Kế
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                Gemini 3.7
              </span>
            </span>
          </button>

          <button
            onClick={() => onTabChange('projects')}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium border-b-2 transition ${
              activeTab === 'projects'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Quản Lý Server & Cấu Hình ({projects.length})</span>
          </button>
        </div>
      </div>
    </header>
  );
};
