import React, { useState, useEffect } from 'react';
import { 
  FileCode2, 
  Copy, 
  Check, 
  Download, 
  Key, 
  Server, 
  ShieldCheck, 
  Terminal, 
  HelpCircle,
  ExternalLink,
  ChevronRight,
  FolderGit2
} from 'lucide-react';
import { DeploymentProject, GeneratedConfigTemplate } from '../types';

interface ConfigGeneratorProps {
  project: DeploymentProject | null;
}

export const ConfigGenerator: React.FC<ConfigGeneratorProps> = ({ project }) => {
  const [templates, setTemplates] = useState<GeneratedConfigTemplate[]>([]);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [webhookUrl, setWebhookUrl] = useState<string>('');
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!project) return;
    fetchTemplates();
  }, [project]);

  const fetchTemplates = async () => {
    if (!project) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/generator/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project }),
      });
      const data = await res.json();
      if (data.templates) {
        setTemplates(data.templates);
        setWebhookUrl(data.webhookEndpoint || '');
      }
    } catch (err) {
      console.error('Error loading config templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (tmpl: GeneratedConfigTemplate) => {
    const blob = new Blob([tmpl.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = tmpl.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!project) {
    return (
      <div className="p-8 text-center text-slate-400 bg-slate-900/60 rounded-xl border border-slate-800">
        Vui lòng chọn hoặc tạo một dự án để xem các file cấu hình CI/CD.
      </div>
    );
  }

  const currentTemplate = templates[selectedTemplateIndex] || templates[0];

  return (
    <div className="space-y-6">
      {/* 3-Step Interactive Tutorial Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="p-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <FolderGit2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">
              Hướng Dẫn Tích Hợp CI/CD Cho Dự Án "{project.name}"
            </h2>
            <p className="text-xs text-slate-400">
              Chỉ cần làm 3 bước này 1 lần duy nhất, từ nay mỗi khi bạn gõ <code className="text-indigo-300 font-mono bg-slate-800 px-1 py-0.5 rounded">git push</code>, web sẽ tự cập nhật ngay lập tức!
            </p>
          </div>
        </div>

        {/* Steps Tab */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <button
            onClick={() => setActiveStep(1)}
            className={`p-3 rounded-xl border text-left transition ${
              activeStep === 1
                ? 'bg-indigo-900/40 border-indigo-500 ring-1 ring-indigo-500/50'
                : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">1</span>
              Tạo File GitHub Actions
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Thêm file <code className="text-slate-300">.github/workflows/deploy.yml</code> vào repo của bạn.
            </p>
          </button>

          <button
            onClick={() => setActiveStep(2)}
            className={`p-3 rounded-xl border text-left transition ${
              activeStep === 2
                ? 'bg-indigo-900/40 border-indigo-500 ring-1 ring-indigo-500/50'
                : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">2</span>
              Cấu Hình Secrets Trên GitHub
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Thêm SSH Key bí mật vào GitHub Settings &gt; Secrets &gt; Actions.
            </p>
          </button>

          <button
            onClick={() => setActiveStep(3)}
            className={`p-3 rounded-xl border text-left transition ${
              activeStep === 3
                ? 'bg-indigo-900/40 border-indigo-500 ring-1 ring-indigo-500/50'
                : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">3</span>
              Thiết Lập Server & Webhook
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Chạy script cài đặt trên VPS hoặc kết nối Webhook tự động.
            </p>
          </button>
        </div>

        {/* Step details content */}
        <div className="mt-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-300">
          {activeStep === 1 && (
            <div className="space-y-2">
              <p className="font-semibold text-white">Bước 1: Tạo workflow tự động hóa trên GitHub</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300">
                <li>Trong mã nguồn dự án của bạn, tạo thư mục <code className="text-indigo-400 font-mono">.github/workflows/</code></li>
                <li>Tạo file tên là <code className="text-indigo-400 font-mono">deploy.yml</code> bên trong thư mục đó.</li>
                <li>Sao chép toàn bộ nội dung file <strong>deploy.yml</strong> ở bên dưới và dán vào.</li>
                <li>Commit và push lên GitHub: <code className="text-cyan-300 font-mono bg-slate-900 px-1.5 py-0.5 rounded">git add . && git commit -m "ci: add automated deploy" && git push</code></li>
              </ol>
            </div>
          )}

          {activeStep === 2 && (
            <div className="space-y-2">
              <p className="font-semibold text-white">Bước 2: Thêm SSH Key bí mật để GitHub kết nối an toàn với máy chủ</p>
              <ol className="list-decimal list-inside space-y-1 text-slate-300">
                <li>Mở repository của bạn trên GitHub: <a href={project.repoUrl} target="_blank" rel="noreferrer" className="text-indigo-400 underline">{project.repoUrl}</a></li>
                <li>Vào tab <strong>Settings</strong> &gt; ở menu bên trái chọn <strong>Secrets and variables</strong> &gt; chọn <strong>Actions</strong>.</li>
                <li>Nhấn nút <strong>New repository secret</strong>:</li>
                <li className="pl-4">
                  - Name: <code className="text-amber-300 font-mono">SERVER_SSH_KEY</code><br />
                  - Value: Dán Private SSH Key của máy chủ VPS của bạn (file <code className="font-mono text-slate-400">id_ed25519</code> hoặc <code className="font-mono text-slate-400">id_rsa</code>).
                </li>
              </ol>
            </div>
          )}

          {activeStep === 3 && (
            <div className="space-y-2">
              <p className="font-semibold text-white">Bước 3: Khởi chạy trên Server hoặc Thiết Lập Webhook Trực Tiếp</p>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
                <div className="text-slate-200 font-medium">Link Webhook Endpoint của dự án:</div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={webhookUrl}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 font-mono text-[11px] text-cyan-300 select-all"
                  />
                  <button
                    onClick={() => handleCopy(webhookUrl)}
                    className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition"
                  >
                    Sao Chép URL
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Dán URL này vào <strong>GitHub &gt; Repo Settings &gt; Webhooks &gt; Add Webhook</strong> để hệ thống tự động nhận tín hiệu mỗi khi push code!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template Code Viewer */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Template Selector Tabs */}
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between overflow-x-auto no-scrollbar gap-2">
          <div className="flex items-center gap-2">
            {templates.map((tmpl, idx) => (
              <button
                key={tmpl.filename}
                onClick={() => setSelectedTemplateIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition shrink-0 ${
                  selectedTemplateIndex === idx
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>{tmpl.filename}</span>
              </button>
            ))}
          </div>

          {currentTemplate && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleCopy(currentTemplate.content)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã sao chép!' : 'Sao chép mã'}</span>
              </button>

              <button
                onClick={() => handleDownload(currentTemplate)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải file</span>
              </button>
            </div>
          )}
        </div>

        {/* Template Description Banner */}
        {currentTemplate && (
          <div className="bg-slate-950/60 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/20">
                {currentTemplate.filepath}
              </span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-300">{currentTemplate.description}</span>
            </div>
            <span className="text-slate-500 uppercase font-mono text-[10px]">{currentTemplate.language}</span>
          </div>
        )}

        {/* Code Content */}
        <div className="p-4 bg-slate-950 font-mono text-xs overflow-x-auto text-slate-200 max-h-[480px]">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">Đang tạo cấu hình tối ưu cho dự án...</div>
          ) : currentTemplate ? (
            <pre className="leading-relaxed select-text">{currentTemplate.content}</pre>
          ) : (
            <div className="text-center py-12 text-slate-500">Không có file cấu hình.</div>
          )}
        </div>
      </div>
    </div>
  );
};
