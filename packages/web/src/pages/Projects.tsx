import { useEffect, useState } from 'react';
import { api, type Project, type ProjectTree, type Dependency, type WorkSessionInfo, type ContextSnapshotInfo } from '../lib/api';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { ProgressBar } from '../components/ProgressBar';
import { CommentPanel } from '../components/CommentPanel';
import { LockBadge } from '../components/LockBadge';
import { ProjectTreeGraph, type ProjectGraphData } from '../components/ProjectTreeGraph';
import { PendingInputs } from '../components/PendingInputs';

type ViewMode = 'list' | 'graph' | 'history';

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [expandedEpic, setExpandedEpic] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const [graphData, setGraphData] = useState<ProjectGraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [sessions, setSessions] = useState<WorkSessionInfo[]>([]);
  const [snapshots, setSnapshots] = useState<ContextSnapshotInfo[]>([]);
  const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);

  useEffect(() => {
    api.listProjects().then(setProjects).catch((e) => setError(e.message));
  }, []);

  const selectProject = async (id: string) => {
    if (selectedId === id) {
      setSelectedId(null);
      setTree(null);
      return;
    }
    setSelectedId(id);
    try {
      const data = await api.getProjectTree(id);
      setTree(data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Load history data when switching to history view
  useEffect(() => {
    if (view !== 'history' || !selectedId) return;
    api.listSessions(selectedId).then(setSessions).catch(() => setSessions([]));
    api.listSnapshots(selectedId).then(setSnapshots).catch(() => setSnapshots([]));
  }, [view, selectedId]);

  // Load graph data for selected project
  useEffect(() => {
    if (view !== 'graph' || !tree) return;

    let cancelled = false;
    setGraphLoading(true);

    async function loadGraphData() {
      try {
        const epicDeps = new Map<string, Dependency[]>();
        const issueDeps = new Map<string, Dependency[]>();

        // Fetch dependencies for all epics
        const epicDepResults = await Promise.allSettled(
          tree!.epics.map((e) => api.getDependencies('epic', e.id)),
        );
        epicDepResults.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            epicDeps.set(tree!.epics[i].id, result.value);
          }
        });

        // Fetch dependencies for all issues
        const allIssues = tree!.epics.flatMap((e) => e.issues || []);
        const issueDepResults = await Promise.allSettled(
          allIssues.map((issue) => api.getDependencies('issue', issue.id)),
        );
        issueDepResults.forEach((result, i) => {
          if (result.status === 'fulfilled') {
            issueDeps.set(allIssues[i].id, result.value);
          }
        });

        if (!cancelled) {
          setGraphData({ project: tree!, epicDependencies: epicDeps, issueDependencies: issueDeps });
          setGraphLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message);
          setGraphLoading(false);
        }
      }
    }

    loadGraphData();
    return () => { cancelled = true; };
  }, [view, tree]);

  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-950">Projects</h2>
        {selectedId && (
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            <button
              onClick={() => setView('list')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'list' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              List
            </button>
            <button
              onClick={() => setView('graph')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'graph' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Graph
            </button>
            <button
              onClick={() => setView('history')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                view === 'history' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              History
            </button>
          </div>
        )}
      </div>

      {/* Project list */}
      {projects.length === 0 && <p className="text-slate-400">Loading...</p>}

      {projects.filter((p) => p.status !== 'cancelled').map((project) => (
        <Card key={project.id}>
          <div className="cursor-pointer" onClick={() => selectProject(project.id)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-slate-400">{selectedId === project.id ? '▾' : '▸'}</span>
                <span className="text-xs text-purple-500 font-mono font-bold">{project.key}</span>
                <PriorityBadge priority={project.priority} />
                <span className="text-sm font-semibold text-slate-800">{project.name}</span>
              </div>
              <StatusBadge status={project.status} />
            </div>
            {project.description && (
              <p className="text-xs text-slate-500 mt-1.5 ml-8">{project.description}</p>
            )}
          </div>

          {selectedId === project.id && tree && view === 'list' && (
            <div className="mt-4 space-y-3">
              {tree.epics.length === 0 && (
                <p className="text-xs text-slate-400 ml-8">No epics yet</p>
              )}
              {tree.epics.map((epic) => (
                <div key={epic.id} className="ml-4 border-l-2 border-teal-200 pl-4">
                  <div
                    className="cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setExpandedEpic(expandedEpic === epic.id ? null : epic.id); }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs">{expandedEpic === epic.id ? '▾' : '▸'}</span>
                        <span className="text-xs text-teal-600 font-mono">{epic.key}</span>
                        <PriorityBadge priority={epic.priority} />
                        <span className="text-sm font-medium text-slate-700">{epic.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <LockBadge epicId={epic.id} />
                        <StatusBadge status={epic.status} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 ml-5">
                      <ProgressBar value={epic.progress} className="flex-1 max-w-xs" />
                      <span className="text-xs text-slate-500">{epic.progress}%</span>
                      <span className="text-xs text-slate-400 ml-2">
                        {(epic.issues || []).filter((i) => i.status === 'done').length}/{(epic.issues || []).length} done
                      </span>
                    </div>
                  </div>

                  {expandedEpic === epic.id && (
                    <div className="mt-2 ml-5 space-y-1">
                      {(epic.issues || []).map((issue) => (
                        <div key={issue.id} className="flex items-center gap-3 py-1.5 hover:bg-gray-50 rounded-lg px-2 transition-colors">
                          <StatusBadge status={issue.status} />
                          <PriorityBadge priority={issue.priority} />
                          <span className="text-xs text-slate-400 font-mono">{issue.key}</span>
                          <span className="text-sm text-slate-700">{issue.title}</span>
                          <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded-md text-slate-500 ml-auto">
                            {issue.issueType}
                          </span>
                          {issue.assignee && (
                            <span className="text-xs text-slate-400">@{issue.assignee}</span>
                          )}
                        </div>
                      ))}
                      {(epic.issues || []).length === 0 && (
                        <p className="text-xs text-slate-400">No issues</p>
                      )}
                      <CommentPanel entityType="epic" entityId={epic.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {selectedId === project.id && tree && view === 'graph' && (
            <div className="mt-4">
              {graphLoading && (
                <div className="flex items-center justify-center h-96 text-slate-400">
                  <div className="flex items-center gap-3">
                    <svg className="animate-spin h-5 w-5 text-teal-500" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Loading graph...
                  </div>
                </div>
              )}
              {!graphLoading && graphData && <ProjectTreeGraph data={graphData} />}
            </div>
          )}

          {selectedId === project.id && view === 'history' && (
            <div className="mt-4 space-y-4">
              {/* Pending human input */}
              <PendingInputs projectId={project.id} />

              {/* Context Snapshots */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Context Snapshots</h3>
                {snapshots.length === 0 ? (
                  <p className="text-xs text-slate-400">No snapshots yet</p>
                ) : (
                  <div className="space-y-2">
                    {snapshots.map((snap) => (
                      <div key={snap.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div
                          className="flex items-center gap-3 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                          onClick={() => setExpandedSnapshot(expandedSnapshot === snap.id ? null : snap.id)}
                        >
                          <span className="text-slate-400 text-xs">{expandedSnapshot === snap.id ? '▾' : '▸'}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            snap.snapshotType === 'handoff' ? 'bg-orange-100 text-orange-700' :
                            snap.snapshotType === 'compact' ? 'bg-purple-100 text-purple-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>{snap.snapshotType}</span>
                          <span className="text-xs text-slate-600">{snap.agentName}</span>
                          <span className="text-xs text-slate-400 ml-auto">
                            {new Date(snap.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {expandedSnapshot === snap.id && (
                          <div className="px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap border-t border-gray-200 bg-white max-h-96 overflow-y-auto">
                            {snap.content}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Work Sessions */}
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Work Sessions</h3>
                {sessions.length === 0 ? (
                  <p className="text-xs text-slate-400">No sessions recorded yet</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((s) => {
                      const duration = s.endedAt
                        ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000)
                        : null;
                      return (
                        <div key={s.id} className="border border-gray-200 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${
                              s.status === 'active' ? 'bg-green-500' :
                              s.status === 'completed' ? 'bg-gray-400' :
                              'bg-red-400'
                            }`} />
                            <span className="text-sm font-medium text-slate-700">{s.agentName}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              s.status === 'active' ? 'bg-green-100 text-green-700' :
                              s.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                              'bg-red-100 text-red-700'
                            }`}>{s.status}</span>
                            {duration !== null && (
                              <span className="text-xs text-slate-400">{duration}m</span>
                            )}
                            <span className="text-xs text-slate-400 ml-auto">
                              {new Date(s.startedAt).toLocaleString()}
                            </span>
                          </div>
                          {s.summary && (
                            <p className="text-xs text-slate-600 mt-1 ml-4">{s.summary}</p>
                          )}
                          {s.issuesWorked && s.issuesWorked.length > 0 && (
                            <div className="flex gap-1 mt-1 ml-4 flex-wrap">
                              {s.issuesWorked.map((key) => (
                                <span key={key} className="text-xs bg-gray-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{key}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
