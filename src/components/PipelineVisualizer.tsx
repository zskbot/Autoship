import React from 'react';
import { 
  GitCommit, 
  Package, 
  ShieldCheck, 
  Cpu, 
  Server, 
  Globe, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { BuildRun, PipelineStage } from '../types';

interface PipelineVisualizerProps {
  currentRun: BuildRun | null;
  onSelectStage?: (stageId: string) => void;
  selectedStageId?: string;
}

export const PipelineVisualizer: React.FC<PipelineVisualizerProps> = ({
  currentRun,
  onSelectStage,
  selectedStageId,
}) => {
  if (!currentRun) {
    return (
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-6 text-center text-slate-400">
        Chưa có lượt chạy pipeline nào. Nhấn nút "Kích Hoạt Deploy" hoặc push code lên GitHub để bắt đầu.
      </div>
    );
  }

  const getStageIcon = (type: string, status: string) => {
    if (status === 'running') {
      return <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />;
    }
    if (status === 'success') {
      return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    }
    if (status === 'failed') {
      return <XCircle className="w-5 h-5 text-rose-400" />;
    }

    switch (type) {
      case 'clone':
        return <GitCommit className="w-5 h-5 text-slate-400" />;
      case 'deps':
        return <Package className="w-5 h-5 text-slate-400" />;
      case 'test':
        return <ShieldCheck className="w-5 h-5 text-slate-400" />;
      case 'build':
      case 'docker':
        return <Cpu className="w-5 h-5 text-slate-400" />;
      case 'deploy':
        return <Server className="w-5 h-5 text-slate-400" />;
      case 'healthcheck':
        return <Globe className="w-5 h-5 text-slate-400" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStageBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
            Đang chạy...
          </span>
        );
      case 'success':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Thành công
          </span>
        );
      case 'failed':
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
            Thất bại
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">
            Chờ thực thi
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-sm">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className={`w-3.5 h-3.5 rounded-full ${
            currentRun.status === 'running' ? 'bg-indigo-400 animate-ping' :
            currentRun.status === 'success' ? 'bg-emerald-400' :
            currentRun.status === 'failed' ? 'bg-rose-500' : 'bg-slate-500'
          }`} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">
                Pipeline #{currentRun.id}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                {currentRun.branch}
              </span>
              <span className="text-xs px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 font-mono">
                {currentRun.commitHash}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xl">
              "{currentRun.commitMessage}" bởi <strong className="text-slate-300">@{currentRun.author}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {currentRun.deployedUrl && currentRun.status === 'success' && (
            <a
              href={currentRun.deployedUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Xem Trang Web Đã Deploy</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <div className="text-right">
            <div className="text-xs text-slate-400">Thời gian chạy</div>
            <div className="text-xs font-mono font-semibold text-slate-200">
              {currentRun.durationSeconds ? `${currentRun.durationSeconds}s` : 'Đang xử lý...'}
            </div>
          </div>
        </div>
      </div>

      {/* Visual Pipeline Stages Stepper */}
      <div className="mt-6 overflow-x-auto pb-2">
        <div className="flex items-center justify-between min-w-[720px] gap-2">
          {currentRun.stages.map((stage: PipelineStage, index: number) => {
            const isSelected = selectedStageId === stage.id;
            const isRunning = stage.status === 'running';
            const isSuccess = stage.status === 'success';
            const isFailed = stage.status === 'failed';

            return (
              <React.Fragment key={stage.id}>
                {/* Stage Card */}
                <button
                  type="button"
                  onClick={() => onSelectStage && onSelectStage(stage.id)}
                  className={`flex-1 p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                      : isRunning
                      ? 'bg-slate-800/90 border-indigo-500/60'
                      : isSuccess
                      ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                      : isFailed
                      ? 'bg-rose-950/20 border-rose-500/60'
                      : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-1.5 rounded-lg bg-slate-800/90 border border-slate-700/60">
                      {getStageIcon(stage.type, stage.status)}
                    </div>
                    {getStageBadge(stage.status)}
                  </div>
                  
                  <div className="text-xs font-bold text-slate-200 truncate">
                    {stage.name}
                  </div>
                  
                  <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between font-mono">
                    <span>{stage.durationMs ? `${(stage.durationMs / 1000).toFixed(1)}s` : '--'}</span>
                    <span className="text-[10px] text-slate-500">{stage.logs.length} dòng log</span>
                  </div>
                </button>

                {/* Connector Arrow */}
                {index < currentRun.stages.length - 1 && (
                  <div className="flex items-center justify-center px-1 text-slate-600">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
