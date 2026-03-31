import { useEffect, useState } from 'react';
import { api, type WorkContext, type EpicLockInfo, type Project } from '../lib/api';
import { Card } from '../components/Card';
import { PendingInputs } from '../components/PendingInputs';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { ProgressBar } from '../components/ProgressBar';

export function Dashboard() {
  const [ctx, setCtx] = useState<WorkContext | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [locks, setLocks] = useState<EpicLockInfo[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getContext().then(setCtx).catch((e) => setError(e.message));
    api.listProjects().then(setProjects).catch(() => setProjects([]));
    api.listLocks().then(setLocks).catch(() => setLocks([]));
  }, []);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!ctx) return <div className="p-6 text-slate-400">Loading...</div>;

  const activeProjects = projects.filter((p) => p.status !== 'cancelled');
  const totalEpics = ctx.epics.length;
  const allIssues = ctx.epics.flatMap((e) => e.issues);
  const totalIssues = allIssues.length;
  const inProgress = allIssues.filter((i) => i.status === 'in_progress').length;
  const done = allIssues.filter((i) => i.status === 'done').length;
  const completionRate = totalIssues > 0 ? Math.round((done / totalIssues) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-slate-950">Dashboard</h2>

      <div className="grid grid-cols-6 gap-4">
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Projects</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{activeProjects.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Epics</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">{totalEpics}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Issues</p>
          <p className="text-2xl font-bold text-teal-600 mt-1">{totalIssues}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">In Progress</p>
          <p className="text-2xl font-bold text-sky-600 mt-1">{inProgress}</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Completion</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{completionRate}%</p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 uppercase tracking-wide">Locks</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{locks.length}</p>
        </Card>
      </div>

      {/* Pending human input requests */}
      <PendingInputs />

      <div className="grid grid-cols-2 gap-6">
        {/* Projects overview */}
        <Card title="Projects">
          <div className="space-y-4">
            {activeProjects.length === 0 && (
              <p className="text-sm text-slate-400">No projects yet</p>
            )}
            {activeProjects.map((project) => {
              // Count epics/issues for this project from context
              const projectEpics = ctx.epics.filter((e) => e.projectId === project.id);
              const projectIssues = projectEpics.flatMap((e) => e.issues);
              const projectDone = projectIssues.filter((i) => i.status === 'done').length;
              const projectTotal = projectIssues.length;
              const projectProgress = projectTotal > 0 ? Math.round((projectDone / projectTotal) * 100) : 0;

              return (
                <div key={project.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-purple-500 font-mono font-bold">{project.key}</span>
                      <span className="text-sm font-medium text-slate-700">{project.name}</span>
                      <PriorityBadge priority={project.priority} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">{projectEpics.length} epics</span>
                      <StatusBadge status={project.status} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ProgressBar value={projectProgress} className="flex-1" />
                    <span className="text-xs text-slate-500 w-14 text-right">{projectDone}/{projectTotal}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Active epics */}
        <Card title="Active Epics">
          <div className="space-y-3">
            {ctx.epics.filter((e) => e.status === 'active').length === 0 && (
              <p className="text-sm text-slate-400">No active epics</p>
            )}
            {ctx.epics.filter((e) => e.status === 'active').map((epic) => (
              <div key={epic.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-teal-600 font-mono">{epic.key}</span>
                    <span className="text-sm text-slate-700">{epic.title}</span>
                  </div>
                  <StatusBadge status={epic.status} />
                </div>
                <div className="flex items-center gap-2">
                  <ProgressBar value={epic.progress} className="flex-1" />
                  <span className="text-xs text-slate-500 w-8 text-right">{epic.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Locked epics */}
        {locks.length > 0 && (
          <Card title="Locked Epics">
            <div className="space-y-2">
              {locks.map((lock) => {
                const expiresAt = new Date(lock.expiresAt);
                const remainingMin = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 60000));
                return (
                  <div key={lock.id} className="flex items-center gap-2 text-sm">
                    <svg className="w-3.5 h-3.5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs text-slate-400 font-mono">{lock.epicId.slice(0, 8)}</span>
                    <span className="text-slate-600">{lock.agentName}</span>
                    <span className="text-xs text-slate-400 ml-auto">{remainingMin}m remaining</span>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Recent activity */}
        <Card title="Recent Activity">
          <div className="space-y-2">
            {ctx.recentActivity.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-slate-400 font-mono w-16">{a.entityType}</span>
                <span className="text-slate-600">{a.action.replace('_', ' ')}</span>
                <span className="text-xs text-slate-400 ml-auto">by {a.actor}</span>
              </div>
            ))}
            {ctx.recentActivity.length === 0 && (
              <p className="text-sm text-slate-400">No recent activity</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
