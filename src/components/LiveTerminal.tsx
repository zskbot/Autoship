import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, 
  Copy, 
  Check, 
  Download, 
  Sparkles, 
  RotateCw, 
  Maximize2, 
  Filter, 
  AlertTriangle,
  Play
} from 'lucide-react';
import { BuildRun, PipelineStage } from '../types';

interface LiveTerminalProps {
  currentRun: BuildRun | null;
  selectedStageId?: string;
  onSelectStage: (stageId: string) => void;
  onDiagnoseErrorWithAi: (logSnippet: string) => void;
}

export const LiveTerminal: React.FC<LiveTerminalProps> = ({
  currentRun,
  selectedStageId,
  onSelectStage,
  onDiagnoseErrorWithAi,
}) => {
  const [copied, setCopied] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const stages = currentRun?.stages || [];
  const activeStage = stages.find((s) => s.id === selectedStageId) || stages[0];

  // Collect all logs or active stage logs
  const displayLogs: string[] = activeStage ? activeStage.logs : [];

  const filteredLogs = filterText
    ? displayLogs.filter((log) => log.toLowerCase().includes(filterText.toLowerCase()))
    : displayLogs;

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [displayLogs, autoScroll]);

  const handleCopyLogs = () => {
    const text = displayLogs.join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const text = displayLogs.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-${currentRun?.id || 'build'}-${activeStage?.type || 'log'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatLogLine = (line: string, index: number) => {
    const isCommand = line.startsWith('>') || line.startsWith('$');
    const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('failed') || line.includes('ERR!');
    const isSuccess = line.includes('✔') || line.includes('✓') || line.includes('Success') || line.includes('HTTP/2 200') || line.includes('passed');
    const isWarning = line.toLowerCase().includes('warn') || line.toLowerCase().includes('notice');

    return (
      <div key={index} className="flex font-mono text-xs leading-relaxed hover:bg-slate-900/60 px-2 py-0.5 rounded">
        <span className="text-slate-600 select-none w-10 text-right pr-3 shrink-0">
          {index + 1}
        </span>
        <span
          className={`flex-1 break-all ${
            isCommand
              ? 'text-cyan-400 font-semibold'
              : isError
              ? 'text-rose-400 bg-rose-950/30 px-1 rounded'
              : isSuccess
              ? 'text-emerald-400'
              : isWarning
              ? 'text-amber-400'
              : 'text-slate-300'
          }`}
        >
          {line}
        </span>
      </div>
    );
  };

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[520px]">
      {/* Terminal Bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Window Dots & Stage Pills */}
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block"></span>
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block"></span>
          </div>

          <div className="h-4 w-px bg-slate-800 shrink-0"></div>

          <div className="flex items-center gap-1.5">
            {stages.map((stg) => (
              <button
                key={stg.id}
                onClick={() => onSelectStage(stg.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition flex items-center gap-1.5 shrink-0 ${
                  activeStage?.id === stg.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    stg.status === 'running'
                      ? 'bg-amber-400 animate-pulse'
                      : stg.status === 'success'
                      ? 'bg-emerald-400'
                      : stg.status === 'failed'
                      ? 'bg-rose-400'
                      : 'bg-slate-500'
                  }`}
                />
                <span className="truncate max-w-[130px]">{stg.name.split('.')[1] || stg.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Search Filter */}
          <div className="relative">
            <input
              type="text"
              placeholder="Lọc log..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-32 focus:w-44 transition-all"
            />
            <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-2 top-2" />
          </div>

          {/* AI Doctor diagnose button if errors found or failed */}
          {(currentRun?.status === 'failed' || activeStage?.status === 'failed') && (
            <button
              onClick={() => onDiagnoseErrorWithAi(displayLogs.join('\n'))}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white shadow-md transition animate-pulse"
              title="Phân tích và sửa lỗi log này với Gemini AI"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Bác Sĩ AI Chẩn Đoán Lỗi</span>
            </button>
          )}

          <button
            onClick={handleCopyLogs}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Sao chép toàn bộ log"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={handleDownloadLogs}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Tải log dạng file .txt"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stage Command Banner */}
      {activeStage?.command && (
        <div className="bg-slate-900/40 border-b border-slate-800/60 px-4 py-2 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2 truncate">
            <span className="text-indigo-400 font-bold">$</span>
            <span className="text-slate-200">{activeStage.command}</span>
          </div>
          <span className="text-[11px] text-slate-500 shrink-0">
            {activeStage.durationMs ? `${(activeStage.durationMs / 1000).toFixed(2)}s` : 'Status: ' + activeStage.status}
          </span>
        </div>
      )}

      {/* Terminal Log Stream Body */}
      <div className="flex-1 p-4 overflow-y-auto font-mono text-xs select-text space-y-0.5">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((line, idx) => formatLogLine(line, idx))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-2">
            <Terminal className="w-8 h-8 text-slate-600" />
            <p>Chưa có log cho stage này. Đang chờ luồng thực thi...</p>
          </div>
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Footer Status Bar */}
      <div className="bg-slate-900/80 border-t border-slate-800 px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              currentRun?.status === 'running' ? 'bg-amber-400 animate-pulse' :
              currentRun?.status === 'success' ? 'bg-emerald-400' :
              currentRun?.status === 'failed' ? 'bg-rose-400' : 'bg-slate-500'
            }`} />
            Trạng thái: {currentRun?.status?.toUpperCase() || 'IDLE'}
          </span>
          <span>•</span>
          <span>{filteredLogs.length} dòng</span>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-400 hover:text-slate-300">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-indigo-500 focus:ring-0 w-3 h-3"
            />
            <span>Auto Scroll</span>
          </label>
          <span className="text-slate-500">UTF-8</span>
          <span className="text-slate-500">bash / zsh</span>
        </div>
      </div>
    </div>
  );
};
