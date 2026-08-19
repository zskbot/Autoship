import React, { useState } from 'react';
import { 
  Bot, 
  Sparkles, 
  Terminal, 
  Layers, 
  Send, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Check,
  Zap,
  HelpCircle
} from 'lucide-react';
import { DeploymentProject } from '../types';

interface AiDevopsDoctorProps {
  project: DeploymentProject | null;
  initialLogText?: string;
}

export const AiDevopsDoctor: React.FC<AiDevopsDoctorProps> = ({
  project,
  initialLogText = '',
}) => {
  const [activeMode, setActiveMode] = useState<'doctor' | 'architect'>('doctor');

  // Doctor state
  const [logInput, setLogInput] = useState<string>(
    initialLogText ||
`Error: Command failed with exit code 1
src/components/Dashboard.tsx:42:15 - error TS2322: Type 'string' is not assignable to type 'number'.
42   const timeout: number = process.env.VITE_TIMEOUT;
                             ~~~~~~~~~~~~~~~~~~~~~~~~
Found 1 fatal compilation error in TypeScript project.
npm ERR! Build failed during bundle phase.`
  );
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [doctorResult, setDoctorResult] = useState<string | null>(null);

  // Architect state
  const [projectDescription, setProjectDescription] = useState('Ứng dụng full-stack React + Express API + PostgreSQL');
  const [techStack, setTechStack] = useState('React Vite, Node.js Express, Tailwind CSS, PostgreSQL, Nginx');
  const [targetServer, setTargetServer] = useState('Ubuntu VPS 22.04 LTS (DigitalOcean/Linode) + Cloudflare DNS');
  const [isDesigning, setIsDesigning] = useState(false);
  const [architectResult, setArchitectResult] = useState<string | null>(null);

  const [copiedDoctor, setCopiedDoctor] = useState(false);
  const [copiedArchitect, setCopiedArchitect] = useState(false);

  const handleDiagnose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logInput.trim()) return;

    setIsDiagnosing(true);
    setDoctorResult(null);

    try {
      const res = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logText: logInput,
          projectContext: project,
        }),
      });
      const data = await res.json();
      if (data.analysis) {
        setDoctorResult(data.analysis);
      } else if (data.error) {
        setDoctorResult('Lỗi: ' + data.error);
      }
    } catch (err: any) {
      setDoctorResult('Không thể kết nối đến AI: ' + err.message);
    } finally {
      setIsDiagnosing(false);
    }
  };

  const handleDesignArchitecture = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsDesigning(true);
    setArchitectResult(null);

    try {
      const res = await fetch('/api/ai/architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: projectDescription,
          stack: techStack,
          targetServer,
        }),
      });
      const data = await res.json();
      if (data.architecture) {
        setArchitectResult(data.architecture);
      } else if (data.error) {
        setArchitectResult('Lỗi: ' + data.error);
      }
    } catch (err: any) {
      setArchitectResult('Không thể kết nối đến AI: ' + err.message);
    } finally {
      setIsDesigning(false);
    }
  };

  const handleCopy = (text: string, isDoc: boolean) => {
    navigator.clipboard.writeText(text);
    if (isDoc) {
      setCopiedDoctor(true);
      setTimeout(() => setCopiedDoctor(false), 2000);
    } else {
      setCopiedArchitect(true);
      setTimeout(() => setCopiedArchitect(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">AI DevOps Architect & Error Doctor</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Gemini 3.7 Flash Engine
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Tự động chẩn đoán lỗi build terminal & thiết kế kiến trúc CI/CD tối ưu cho mọi mô hình dự án
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveMode('doctor')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeMode === 'doctor'
                  ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Chẩn Đoán Lỗi Build (Log Doctor)
            </button>
            <button
              onClick={() => setActiveMode('architect')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeMode === 'architect'
                  ? 'bg-indigo-600 text-white shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Thiết Kế Kiến Trúc CI/CD Tùy Chỉnh
            </button>
          </div>
        </div>

        {/* Doctor Mode */}
        {activeMode === 'doctor' && (
          <div className="mt-5 space-y-4">
            <form onSubmit={handleDiagnose} className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  Dán nội dung Log Lỗi từ Terminal hoặc GitHub Actions:
                </label>
                <button
                  type="button"
                  onClick={() => setLogInput(initialLogText || 'error: failed to compile')}
                  className="text-[11px] text-amber-400 hover:underline"
                >
                  Tải mẫu lỗi
                </button>
              </div>

              <textarea
                value={logInput}
                onChange={(e) => setLogInput(e.target.value)}
                rows={6}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 font-mono text-xs text-rose-300 focus:outline-none focus:border-amber-500 leading-relaxed"
                placeholder="Dán lỗi compile, lỗi SSH, lỗi docker hoặc npm build vào đây..."
                required
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isDiagnosing || !logInput.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-slate-950 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                >
                  {isDiagnosing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gemini đang phân tích nguyên nhân...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Chẩn Đoán & Nhận Hướng Dẫn Sửa Ngay</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {doctorResult && (
              <div className="bg-slate-950 rounded-2xl border border-amber-500/30 overflow-hidden shadow-2xl mt-4">
                <div className="bg-amber-950/30 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <Sparkles className="w-4 h-4" />
                    <span>Kết Quả Chẩn Đoán Từ Gemini AI</span>
                  </div>
                  <button
                    onClick={() => handleCopy(doctorResult, true)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                  >
                    {copiedDoctor ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="p-5 font-sans text-xs text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
                  {doctorResult}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Architect Mode */}
        {activeMode === 'architect' && (
          <div className="mt-5 space-y-4">
            <form onSubmit={handleDesignArchitecture} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Mô tả dự án & yêu cầu
                  </label>
                  <input
                    type="text"
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    placeholder="VD: Web bán hàng cần deploy tự động khi push code"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Tech Stack & Frameworks
                  </label>
                  <input
                    type="text"
                    value={techStack}
                    onChange={(e) => setTechStack(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    placeholder="VD: Next.js 14, NestJS, Docker, Redis"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Loại máy chủ / Hạ tầng triển khai (Target Environment)
                </label>
                <input
                  type="text"
                  value={targetServer}
                  onChange={(e) => setTargetServer(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="VD: VPS Ubuntu 22.04 / AWS EC2 / Google Cloud Run"
                  required
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isDesigning}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-500/25 transition disabled:opacity-50"
                >
                  {isDesigning ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gemini đang vẽ kiến trúc CI/CD...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      <span>Thiết Kế Trọn Gói Pipeline CI/CD</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {architectResult && (
              <div className="bg-slate-950 rounded-2xl border border-indigo-500/30 overflow-hidden shadow-2xl mt-4">
                <div className="bg-indigo-950/40 border-b border-indigo-500/30 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <span>Bản Thiết Kế Tự Động Hóa Triển Khai (DevOps Blueprint)</span>
                  </div>
                  <button
                    onClick={() => handleCopy(architectResult, false)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
                  >
                    {copiedArchitect ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="p-5 font-sans text-xs text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
                  {architectResult}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
