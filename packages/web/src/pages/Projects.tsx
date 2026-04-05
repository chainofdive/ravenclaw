import { useEffect, useState } from 'react';
import { api, type Project, type ProjectTree, type Dependency, type WorkSessionInfo, type ContextSnapshotInfo } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { ProgressBar } from '../components/ProgressBar';
import { CommentPanel } from '../components/CommentPanel';
import { LockBadge } from '../components/LockBadge';
import { ProjectTreeGraph, type ProjectGraphData } from '../components/ProjectTreeGraph';
import { PendingInputs } from '../components/PendingInputs';
import { CommandPanel } from '../components/CommandPanel';
import { ResizeHandle } from '../components/ResizeHandle';
import { DetailPanel } from '../components/DetailPanel';

const LEFT_MIN = 160;
const LEFT_DEFAULT = 224;
const CMD_MIN = 320;
const CMD_DEFAULT = 480;

type ContentTab = 'list' | 'graph' | 'history';

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tree, setTree] = useState<ProjectTree | null>(null);
  const [contentTab, setContentTab] = useState<ContentTab>('list');
  const [expandedEpic, setExpandedEpic] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandFullscreen, setCommandFullscreen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const [cmdWidth, setCmdWidth] = useState(CMD_DEFAULT);
  const [error, setError] = useState('');
  const [detailTarget, setDetailTarget] = useState<{ type: 'project' | 'epic' | 'issue'; id: string } | null>(null);

  // Graph
  const [graphData, setGraphData] = useState<ProjectGraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);

  // History
  const [sessions, setSessions] = useState<WorkSessionInfo[]>([]);
  const [snapshots, setSnapshots] = useState<ContextSnapshotInfo[]>([]);
  const [expandedSnapshot, setExpandedSnapshot] = useState<string | null>(null);

  useEffect(() => {
    api.listProjects().then((p) => {
      setProjects(p);
      // Auto-select first non-cancelled project
      const active = p.find((proj) => proj.status !== 'cancelled');
      if (active && !selectedId) setSelectedId(active.id);
    }).catch((e) => setError(e.message));
  }, []);

  // Load tree when project is selected
  useEffect(() => {
    if (!selectedId) return;
    api.getProjectTree(selectedId).then(setTree).catch((e) => setError(e.message));
  }, [selectedId]);

  // Load history when tab is history
  useEffect(() => {
    if (contentTab !== 'history' || !selectedId) return;
    api.listSessions(selectedId).then(setSessions).catch(() => setSessions([]));
    api.listSnapshots(selectedId).then(setSnapshots).catch(() => setSnapshots([]));
  }, [contentTab, selectedId]);

  // Load graph data
  useEffect(() => {
    if (contentTab !== 'graph' || !tree) return;
    let cancelled = false;
    setGraphLoading(true);

    async function loadGraphData() {
      try {
        const epicDeps = new Map<string, Dependency[]>();
        const issueDeps = new Map<string, Dependency[]>();
        const epicDepResults = await Promise.allSettled(tree!.epics.map((e) => api.getDependencies('epic', e.id)));
        epicDepResults.forEach((r, i) => { if (r.status === 'fulfilled') epicDeps.set(tree!.epics[i].id, r.value); });
        const allIssues = tree!.epics.flatMap((e) => e.issues || []);
        const issueDepResults = await Promise.allSettled(allIssues.map((issue) => api.getDependencies('issue', issue.id)));
        issueDepResults.forEach((r, i) => { if (r.status === 'fulfilled') issueDeps.set(allIssues[i].id, r.value); });
        if (!cancelled) { setGraphData({ project: tree!, epicDependencies: epicDeps, issueDependencies: issueDeps }); setGraphLoading(false); }
      } catch (e: any) { if (!cancelled) { setError(e.message); setGraphLoading(false); } }
    }
    loadGraphData();
    return () => { cancelled = true; };
  }, [contentTab, tree]);

  const selectedProject = projects.find((p) => p.id === selectedId);
  const activeProjects = projects.filter((p) => p.status !== 'cancelled');

  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="flex h-full">
      {/* ── Left: Project List ──────────────────────────────── */}
      <div className="relative border-r border-gray-200 bg-white shrink-0 overflow-y-auto" style={{ width: leftWidth }}>
        <ResizeHandle
          side="left"
          onResize={(delta) => {
            const maxW = Math.floor(window.innerWidth / 3);
            setLeftWidth((w) => Math.max(LEFT_MIN, Math.min(maxW, w + delta)));
          }}
        />
        <div className="p-3 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Projects</h3>
        </div>
        {activeProjects.length === 0 && (
          <p className="p-3 text-xs text-slate-400">No projects</p>
        )}
        {activeProjects.map((p) => (
          <button
            key={p.id}
            onClick={() => { setSelectedId(p.id); setExpandedEpic(null); }}
            className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition-colors ${
              selectedId === p.id
                ? 'bg-teal-50 border-l-2 border-l-teal-500'
                : 'hover:bg-gray-50 border-l-2 border-l-transparent'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-purple-500 font-mono font-bold">{p.key}</span>
              <StatusBadge status={p.status} />
            </div>
            <p className="text-sm font-medium text-slate-800 mt-0.5 truncate">{p.name}</p>
          </button>
        ))}
      </div>

      {/* ── Center: Content Area ────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {!selectedProject ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            Select a project
          </div>
        ) : (
          <>
            {/* Header + Tabs */}
            <div className="px-5 pt-4 pb-2 border-b border-gray-200 bg-white shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 cursor-pointer hover:text-teal-600 transition-colors"
                    onClick={() => setDetailTarget({ type: 'project', id: selectedProject.id })}
                    title="Click to view details">
                    <span className="text-purple-500 font-mono mr-2">{selectedProject.key}</span>
                    {selectedProject.name}
                  </h2>
                  {selectedProject.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{selectedProject.description}</p>
                  )}
                  {selectedProject.directory && (
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">{selectedProject.directory}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={selectedProject.priority} />
                  <button
                    onClick={() => setCommandOpen(!commandOpen)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      commandOpen
                        ? 'bg-teal-50 text-teal-700 border-teal-300'
                        : 'bg-white text-slate-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Command
                  </button>
                </div>
              </div>

              {/* Pending human inputs */}
              <PendingInputs projectId={selectedId!} />

              <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 mt-2">
                {(['list', 'graph', 'history'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setContentTab(tab)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                      contentTab === tab ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {/* ── List View ─────────────────────────────── */}
              {contentTab === 'list' && tree && (
                <div className="p-4 space-y-2">
                  {tree.epics.length === 0 && (
                    <p className="text-sm text-slate-400">No epics yet</p>
                  )}
                  {tree.epics.map((epic) => (
                    <div key={epic.id} className="border border-gray-200 rounded-lg bg-white">
                      <div
                        className="cursor-pointer px-4 py-3"
                        onClick={() => setExpandedEpic(expandedEpic === epic.id ? null : epic.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-xs">{expandedEpic === epic.id ? '▾' : '▸'}</span>
                            <span className="text-xs text-teal-600 font-mono">{epic.key}</span>
                            <PriorityBadge priority={epic.priority} />
                            <span className="text-sm font-medium text-slate-700 hover:text-teal-600 transition-colors"
                              onClick={(e) => { e.stopPropagation(); setDetailTarget({ type: 'epic', id: epic.id }); }}>
                              {epic.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <LockBadge epicId={epic.id} />
                            <StatusBadge status={epic.status} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 ml-5">
                          <ProgressBar value={epic.progress} className="flex-1 max-w-xs" />
                          <span className="text-xs text-slate-500">{epic.progress}%</span>
                          <span className="text-xs text-slate-400">
                            {(epic.issues || []).filter((i) => i.status === 'done').length}/{(epic.issues || []).length}
                          </span>
                        </div>
                      </div>

                      {expandedEpic === epic.id && (
                        <div className="px-4 pb-3 ml-5 space-y-1 border-t border-gray-100 pt-2">
                          {(epic.issues || []).map((issue) => (
                            <div key={issue.id} className="flex items-center gap-3 py-1.5 hover:bg-gray-50 rounded-lg px-2 transition-colors cursor-pointer"
                              onClick={() => setDetailTarget({ type: 'issue', id: issue.id })}>
                              <StatusBadge status={issue.status} />
                              <PriorityBadge priority={issue.priority} />
                              <span className="text-xs text-slate-400 font-mono">{issue.key}</span>
                              <span className="text-sm text-slate-700 hover:text-teal-600 transition-colors">{issue.title}</span>
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded-md text-slate-500 ml-auto">{issue.issueType}</span>
                              {issue.assignee && <span className="text-xs text-slate-400">@{issue.assignee}</span>}
                            </div>
                          ))}
                          {(epic.issues || []).length === 0 && <p className="text-xs text-slate-400">No issues</p>}
                          <CommentPanel entityType="epic" entityId={epic.id} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Graph View ────────────────────────────── */}
              {contentTab === 'graph' && (
                <div className="h-full">
                  {graphLoading && (
                    <div className="flex items-center justify-center h-64 text-slate-400">
                      <svg className="animate-spin h-5 w-5 text-teal-500 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading graph...
                    </div>
                  )}
                  {!graphLoading && graphData && (
                    <div className="h-[calc(100vh-14rem)]">
                      <ProjectTreeGraph data={graphData} />
                    </div>
                  )}
                </div>
              )}

              {/* ── History View ──────────────────────────── */}
              {contentTab === 'history' && (
                <div className="p-4 space-y-4">
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
                              <span className="text-xs text-slate-400 ml-auto">{new Date(snap.createdAt).toLocaleString()}</span>
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
                                  s.status === 'active' ? 'bg-green-500' : s.status === 'completed' ? 'bg-gray-400' : 'bg-red-400'
                                }`} />
                                <span className="text-sm font-medium text-slate-700">{s.agentName}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  s.status === 'active' ? 'bg-green-100 text-green-700' : s.status === 'completed' ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-700'
                                }`}>{s.status}</span>
                                {duration !== null && <span className="text-xs text-slate-400">{duration}m</span>}
                                <span className="text-xs text-slate-400 ml-auto">{new Date(s.startedAt).toLocaleString()}</span>
                              </div>
                              {s.summary && <p className="text-xs text-slate-600 mt-1 ml-4">{s.summary}</p>}
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
            </div>
          </>
        )}
      </div>

      {/* ── Command Overlay / Fullscreen ─────────────────────── */}
      {selectedId && selectedProject && (
        <>
          {/* Backdrop (side panel only, not fullscreen) */}
          {commandOpen && !commandFullscreen && (
            <div
              className="fixed inset-0 bg-black/10 z-30"
              onClick={() => setCommandOpen(false)}
            />
          )}

          {/* Panel — side or fullscreen */}
          <div
            className={`fixed z-40 bg-white flex flex-col transition-all duration-300 ease-in-out ${
              commandFullscreen
                ? 'inset-0'
                : `top-0 right-0 h-full border-l border-gray-200 shadow-2xl ${
                    commandOpen ? 'translate-x-0' : 'translate-x-full'
                  }`
            }`}
            style={commandFullscreen ? undefined : { width: cmdWidth }}
          >
            {/* Resize handle (side mode only) */}
            {!commandFullscreen && (
              <ResizeHandle
                side="right"
                onResize={(delta) => {
                  const maxW = Math.floor(window.innerWidth / 3);
                  setCmdWidth((w) => Math.max(CMD_MIN, Math.min(maxW, w + delta)));
                }}
              />
            )}

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Command</h3>
                <p className="text-xs text-slate-400">{selectedProject.key} {selectedProject.name}</p>
              </div>
              <div className="flex items-center gap-1">
                {/* Fullscreen toggle */}
                <button
                  onClick={() => setCommandFullscreen(!commandFullscreen)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-gray-100 rounded transition-colors"
                  title={commandFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {commandFullscreen ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                    </svg>
                  )}
                </button>
                {/* Close */}
                <button
                  onClick={() => { setCommandOpen(false); setCommandFullscreen(false); }}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden">
              <CommandPanel projectId={selectedId} projectKey={selectedProject.key} />
            </div>
          </div>
        </>
      )}

      {detailTarget && (
        <DetailPanel entityType={detailTarget.type} entityId={detailTarget.id}
          onClose={() => setDetailTarget(null)}
          onUpdated={() => {
            if (selectedId) {
              api.getProjectTree(selectedId).then(setTree).catch(() => {});
            }
          }} />
      )}
    </div>
  );
}
