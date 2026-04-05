import { useEffect, useState } from 'react';
import { api, type Epic, type Dependency } from '../lib/api';
import { Card } from '../components/Card';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { ProgressBar } from '../components/ProgressBar';
import { EpicTreeGraph, type GraphData } from '../components/EpicTreeGraph';
import { CommentPanel } from '../components/CommentPanel';
import { LockBadge } from '../components/LockBadge';
import { DetailPanel } from '../components/DetailPanel';

type ViewMode = 'list' | 'graph';

export function Epics() {
  const [epics, setEpics] = useState<Epic[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tree, setTree] = useState<Epic | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [graphLoading, setGraphLoading] = useState(false);
  const [detailTarget, setDetailTarget] = useState<{ type: 'epic' | 'issue'; id: string } | null>(null);

  const loadEpics = () => api.listEpics().then(setEpics).catch((e) => setError(e.message));
  useEffect(() => { loadEpics(); }, []);

  useEffect(() => {
    if (view !== 'graph' || epics.length === 0) return;
    let cancelled = false;
    setGraphLoading(true);
    async function loadGraphData() {
      try {
        const trees = new Map<string, Epic>();
        const dependencies = new Map<string, Dependency[]>();
        const treeResults = await Promise.allSettled(epics.map((e) => api.getEpicTree(e.id)));
        treeResults.forEach((result, i) => {
          if (result.status === 'fulfilled') trees.set(epics[i].id, result.value);
        });
        const allIssues = Array.from(trees.values()).flatMap((t) => t.issues || []);
        const depResults = await Promise.allSettled(allIssues.map((issue) => api.getDependencies('issue', issue.id)));
        depResults.forEach((result, i) => {
          if (result.status === 'fulfilled') dependencies.set(allIssues[i].id, result.value);
        });
        if (!cancelled) { setGraphData({ epics, trees, dependencies }); setGraphLoading(false); }
      } catch (e: any) { if (!cancelled) { setError(e.message); setGraphLoading(false); } }
    }
    loadGraphData();
    return () => { cancelled = true; };
  }, [view, epics]);

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); setTree(null); return; }
    setExpanded(id);
    try { setTree(await api.getEpicTree(id)); } catch (e: any) { setError(e.message); }
  };

  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-950">Epics</h2>
        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          <button onClick={() => setView('list')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'list' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            List View
          </button>
          <button onClick={() => setView('graph')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${view === 'graph' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            Graph View
          </button>
        </div>
      </div>

      {view === 'list' && (
        <>
          {epics.length === 0 && <p className="text-slate-400">Loading...</p>}
          {epics.map((epic) => (
            <Card key={epic.id}>
              <div className="cursor-pointer" onClick={() => toggleExpand(epic.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400">{expanded === epic.id ? '▾' : '▸'}</span>
                    <span className="text-xs text-slate-400 font-mono">{epic.key}</span>
                    <PriorityBadge priority={epic.priority} />
                    <span className="text-sm font-medium text-slate-800 hover:text-teal-600 transition-colors"
                      onClick={(e) => { e.stopPropagation(); setDetailTarget({ type: 'epic', id: epic.id }); }}>
                      {epic.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <LockBadge epicId={epic.id} />
                    <StatusBadge status={epic.status} />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 ml-8">
                  <ProgressBar value={epic.progress} className="flex-1 max-w-xs" />
                  <span className="text-xs text-slate-500">{epic.progress}%</span>
                </div>
                {epic.description && <p className="text-xs text-slate-500 mt-1.5 ml-8 line-clamp-2">{epic.description}</p>}
              </div>

              {expanded === epic.id && tree && (
                <div className="mt-4 ml-8 border-l-2 border-teal-200 pl-4 space-y-2">
                  {tree.issues && tree.issues.length > 0 ? (
                    tree.issues.map((issue) => (
                      <div key={issue.id}
                        className="flex items-center gap-3 py-1.5 hover:bg-gray-50 rounded-lg px-2 transition-colors cursor-pointer"
                        onClick={() => setDetailTarget({ type: 'issue', id: issue.id })}>
                        <StatusBadge status={issue.status} />
                        <PriorityBadge priority={issue.priority} />
                        <span className="text-xs text-slate-400 font-mono">{issue.key}</span>
                        <span className="text-sm text-slate-700 hover:text-teal-600 transition-colors">{issue.title}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded-md text-slate-500 ml-auto">{issue.issueType}</span>
                        {issue.assignee && <span className="text-xs text-slate-400">@{issue.assignee}</span>}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400">No issues</p>
                  )}
                  <CommentPanel entityType="epic" entityId={epic.id} />
                </div>
              )}
            </Card>
          ))}
        </>
      )}

      {view === 'graph' && (
        <>
          {graphLoading && (
            <div className="flex items-center justify-center h-96 text-slate-400">
              <div className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-teal-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading graph data...
              </div>
            </div>
          )}
          {!graphLoading && graphData && <EpicTreeGraph data={graphData} />}
          {!graphLoading && !graphData && epics.length === 0 && <p className="text-slate-400">Loading...</p>}
        </>
      )}

      {detailTarget && (
        <DetailPanel entityType={detailTarget.type} entityId={detailTarget.id}
          onClose={() => setDetailTarget(null)} onUpdated={loadEpics} />
      )}
    </div>
  );
}
