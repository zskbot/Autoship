import React, { useState, useEffect, useCallback } from 'react';
import { 
  Terminal, 
  Layers, 
  FileCode2, 
  Radio, 
  Bot, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Sparkles, 
  Server, 
  GitBranch, 
  Zap, 
  RefreshCw,
  Plus,
  ArrowUpRight
} from 'lucide-react';
import { BuildRun, DeploymentProject } from './types';
import { Header } from './components/Header';
import { PipelineVisualizer } from './components/PipelineVisualizer';
import { LiveTerminal } from './components/LiveTerminal';
import { ConfigGenerator } from './components/ConfigGenerator';
import { WebhookManager } from './components/WebhookManager';
import { AiDevopsDoctor } from './components/AiDevopsDoctor';
import { ProjectList } from './components/ProjectList';
import { ProjectModal } from './components/ProjectModal';

export default function App() {
  const [projects, setProjects] = useState<DeploymentProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<DeploymentProject | null>(null);
  const [buildRuns, setBuildRuns] = useState<BuildRun[]>([]);
  const [currentRun, setCurrentRun] = useState<BuildRun | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'pipelines' | 'configs' | 'webhooks' | 'ai-doctor' | 'projects'>('pipelines');
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<DeploymentProject | null>(null);
  const [doctorLogInput, setDoctorLogInput] = useState<string>('');

  // Fetch projects and pipeline runs
  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
        if (!selectedProject && data.projects.length > 0) {
          setSelectedProject(data.projects[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  }, [selectedProject]);

  const fetchPipelines = useCallback(async (projId?: string) => {
    try {
      const url = projId ? `/api/pipelines?projectId=${projId}` : '/api/pipelines';
      const res = await fetch(url);
      const data = await res.json();
      if (data.runs) {
        setBuildRuns(data.runs);
        // If no current run selected or current run is running, keep updating
        if (data.runs.length > 0) {
          setCurrentRun((prev) => {
            if (!prev) return data.runs[0];
            const updated = data.runs.find((r: BuildRun) => r.id === prev.id);
            return updated || data.runs[0];
          });
        }
      }
    } catch (err) {
      console.error('Error fetching pipelines:', err);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchPipelines();
  }, [fetchProjects, fetchPipelines]);

  // Polling when build is active
  useEffect(() => {
    const isRunning = currentRun?.status === 'running' || buildRuns.some((r) => r.status === 'running');
    if (!isRunning) return;

    const interval = setInterval(() => {
      fetchPipelines(selectedProject?.id);
    }, 1200);

    return () => clearInterval(interval);
  }, [currentRun?.status, buildRuns, selectedProject?.id, fetchPipelines]);

  // Trigger manual deployment pipeline
  const handleTriggerDeploy = async (projectId?: string, shouldFail: boolean = false) => {
    const targetProjId = projectId || selectedProject?.id;
    if (!targetProjId) return;

    setIsTriggering(true);
    try {
      const res = await fetch('/api/pipelines/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: targetProjId,
          commitMessage: `chore(deploy): trigger manual pipeline build #${Date.now().toString().slice(-4)}`,
          shouldFail,
        }),
      });
      const data = await res.json();
      if (data.run) {
        setCurrentRun(data.run);
        setSelectedStageId(data.run.stages[0]?.id);
        setActiveTab('pipelines');
        fetchPipelines(targetProjId);
      }
    } catch (err) {
      console.error('Error triggering deploy:', err);
    } finally {
      setIsTriggering(false);
    }
  };

  // Save or edit project
  const handleSaveProject = async (projectData: Partial<DeploymentProject>) => {
    if (editingProject) {
      // PUT
      await fetch(`/api/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });
    } else {
      // POST
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });
      const data = await res.json();
      if (data.project) {
        setSelectedProject(data.project);
      }
    }
    fetchProjects();
  };

  const handleDeleteProject = async (projId: string) => {
    await fetch(`/api/projects/${projId}`, { method: 'DELETE' });
    if (selectedProject?.id === projId) {
      setSelectedProject(null);
    }
    fetchProjects();
    fetchPipelines();
  };

  // Switch to AI Doctor with log pre-filled
  const handleDiagnoseWithAi = (logSnippet: string) => {
    setDoctorLogInput(logSnippet);
    setActiveTab('ai-doctor');
  };

  // Calculate Metrics
  const totalRuns = buildRuns.length;
  const successRuns = buildRuns.filter((r) => r.status === 'success').length;
  const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 100;
  const avgDuration = totalRuns > 0 
    ? Math.round(buildRuns.reduce((acc, curr) => acc + (curr.durationSeconds || 35), 0) / totalRuns)
    : 42;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased">
      {/* Header Bar */}
      <Header
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={(p) => {
          setSelectedProject(p);
          fetchPipelines(p.id);
        }}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenNewProjectModal={() => {
          setEditingProject(null);
          setIsModalOpen(true);
        }}
        onTriggerDeploy={() => handleTriggerDeploy()}
        isTriggering={isTriggering}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Metric Quick Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Tỷ Lệ Build Thành Công</span>
              <span className="text-lg font-extrabold text-emerald-400 font-mono">{successRate}%</span>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Thời Gian Build TB</span>
              <span className="text-lg font-extrabold text-indigo-300 font-mono">~{avgDuration}s</span>
            </div>
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Tổng Số Lượt Deploy</span>
              <span className="text-lg font-extrabold text-white font-mono">{totalRuns}</span>
            </div>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Zap className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-medium block">Tự Động Khi Push</span>
              <span className="text-lg font-extrabold text-cyan-400 font-mono">ACTIVE</span>
            </div>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Radio className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* Tab 1: Pipelines & Real-time Live Terminal View */}
        {activeTab === 'pipelines' && (
          <div className="space-y-6">
            {/* Visual Stepper */}
            <PipelineVisualizer
              currentRun={currentRun}
              selectedStageId={selectedStageId}
              onSelectStage={setSelectedStageId}
            />

            {/* Terminal and Recent Runs Split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Terminal */}
              <div className="lg:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span>Live Build Streaming Logs</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTriggerDeploy(undefined, true)}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-medium px-2 py-0.5 rounded bg-rose-950/40 border border-rose-800/50"
                      title="Chạy thử kịch bản build lỗi để test tính năng AI Doctor"
                    >
                      Thử Giả Lập Lỗi Build
                    </button>
                    <button
                      onClick={() => fetchPipelines(selectedProject?.id)}
                      className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Làm mới log"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <LiveTerminal
                  currentRun={currentRun}
                  selectedStageId={selectedStageId}
                  onSelectStage={setSelectedStageId}
                  onDiagnoseErrorWithAi={handleDiagnoseWithAi}
                />
              </div>

              {/* Right Col: Recent Build History */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col h-[560px]">
                <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>Lịch Sử Deploy Gần Đây</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {buildRuns.length} builds
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 p-1">
                  {buildRuns.map((run) => {
                    const isSelected = currentRun?.id === run.id;
                    return (
                      <div
                        key={run.id}
                        onClick={() => {
                          setCurrentRun(run);
                          setSelectedStageId(run.stages[0]?.id);
                        }}
                        className={`p-3 rounded-lg transition cursor-pointer text-xs space-y-1.5 ${
                          isSelected
                            ? 'bg-indigo-950/50 border border-indigo-500/40 text-white'
                            : 'hover:bg-slate-800/50 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-mono">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                run.status === 'running'
                                  ? 'bg-amber-400 animate-pulse'
                                  : run.status === 'success'
                                  ? 'bg-emerald-400'
                                  : 'bg-rose-400'
                              }`}
                            />
                            <strong className="text-white">#{run.id.replace('run-', '')}</strong>
                            <span className="text-slate-500">•</span>
                            <span className="text-indigo-400">{run.branch}</span>
                          </div>
                          <span className="text-[11px] text-slate-500">
                            {new Date(run.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-400 line-clamp-1">
                          {run.commitMessage}
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
                          <span>@{run.author}</span>
                          <span>{run.durationSeconds ? `${run.durationSeconds}s` : 'running...'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Config Generator & GitHub Actions Setup */}
        {activeTab === 'configs' && (
          <ConfigGenerator project={selectedProject} />
        )}

        {/* Tab 3: GitHub Webhooks & Simulator */}
        {activeTab === 'webhooks' && (
          <WebhookManager
            project={selectedProject}
            onPipelineTriggered={() => {
              fetchPipelines(selectedProject?.id);
              setActiveTab('pipelines');
            }}
          />
        )}

        {/* Tab 4: AI DevOps Doctor & Architect */}
        {activeTab === 'ai-doctor' && (
          <AiDevopsDoctor
            project={selectedProject}
            initialLogText={doctorLogInput}
          />
        )}

        {/* Tab 5: Project Management */}
        {activeTab === 'projects' && (
          <ProjectList
            projects={projects}
            selectedProject={selectedProject}
            onSelectProject={setSelectedProject}
            onEditProject={(p) => {
              setEditingProject(p);
              setIsModalOpen(true);
            }}
            onDeleteProject={handleDeleteProject}
            onTriggerDeploy={(pId) => handleTriggerDeploy(pId)}
            onOpenNewProjectModal={() => {
              setEditingProject(null);
              setIsModalOpen(true);
            }}
          />
        )}
      </main>

      {/* New/Edit Project Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProject(null);
        }}
        onSaveProject={handleSaveProject}
        initialProject={editingProject}
      />
    </div>
  );
}
