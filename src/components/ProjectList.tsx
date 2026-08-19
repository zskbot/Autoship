import React from 'react';
import { 
  Server, 
  GitBranch, 
  Play, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Globe, 
  ExternalLink,
  Plus
} from 'lucide-react';
import { DeploymentProject } from '../types';

interface ProjectListProps {
  projects: DeploymentProject[];
  selectedProject: DeploymentProject | null;
  onSelectProject: (project: DeploymentProject) => void;
  onEditProject: (project: DeploymentProject) => void;
  onDeleteProject: (projectId: string) => void;
  onTriggerDeploy: (projectId: string) => void;
  onOpenNewProjectModal: () => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  selectedProject,
  onSelectProject,
  onEditProject,
  onDeleteProject,
  onTriggerDeploy,
  onOpenNewProjectModal,
}) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Danh Sách Dự Án & Máy Chủ Triển Khai</h2>
          <p className="text-xs text-slate-400">
            Quản lý các repository kết nối tự động hóa, cấu hình máy chủ VPS, Nginx, Docker và biến môi trường
          </p>
        </div>

        <button
          onClick={onOpenNewProjectModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Dự Án Mới</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((p) => {
          const isSelected = selectedProject?.id === p.id;
          return (
            <div
              key={p.id}
              onClick={() => onSelectProject(p)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                isSelected
                  ? 'bg-indigo-950/30 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                  : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white tracking-tight">{p.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                      {p.framework}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1 font-mono">
                    <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{p.branch}</span>
                    <span>•</span>
                    <span className="truncate max-w-[200px] text-slate-300">{p.repoUrl.replace('https://github.com/', '')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditProject(p);
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    title="Chỉnh sửa cấu hình"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Bạn có chắc muốn xóa dự án "${p.name}"?`)) {
                        onDeleteProject(p.id);
                      }
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 transition"
                    title="Xóa dự án"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Target specs */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 mb-4 font-mono text-slate-300">
                <div>
                  <span className="text-slate-500 text-[10px] block">SERVER TARGET</span>
                  <span>{p.serverIp || 'Cloud Run / Localhost'}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">DEPLOY PATH</span>
                  <span className="truncate block">{p.deployPath || '/var/www'}</span>
                </div>
              </div>

              {/* Footer info & Action */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      p.lastDeployStatus === 'success'
                        ? 'bg-emerald-400'
                        : p.lastDeployStatus === 'failed'
                        ? 'bg-rose-500'
                        : 'bg-slate-500'
                    }`}
                  />
                  <span className="text-slate-400">
                    {p.lastDeployedAt
                      ? `Deploy lúc: ${new Date(p.lastDeployedAt).toLocaleTimeString()} (${p.totalBuilds} lần build)`
                      : 'Chưa chạy build'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTriggerDeploy(p.id);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-sm"
                >
                  <Play className="w-3 h-3" />
                  <span>Build & Deploy</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
