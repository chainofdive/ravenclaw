import { useEffect, useState } from 'react';
import { api, type Issue } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { PriorityBadge } from '../components/PriorityBadge';
import { DetailPanel } from '../components/DetailPanel';

const statuses = ['all', 'todo', 'in_progress', 'done', 'backlog', 'cancelled'];
const priorities = ['all', 'critical', 'high', 'medium', 'low'];

export function Issues() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [selectedIssue, setSelectedIssue] = useState<{ id: string } | null>(null);

  const loadIssues = () => api.listIssues().then(setIssues).catch((e) => setError(e.message));
  useEffect(() => { loadIssues(); }, []);

  if (error) return <div className="p-6 text-red-600">{error}</div>;

  const filtered = issues.filter((i) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && i.priority !== priorityFilter) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase()) && !i.key.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-semibold text-slate-950">Issues</h2>

      <div className="flex gap-3 items-center">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-colors">
          {statuses.map((s) => <option key={s} value={s}>{s === 'all' ? 'All Status' : s.replace('_', ' ')}</option>)}
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-colors">
          {priorities.map((p) => <option key={p} value={p}>{p === 'all' ? 'All Priority' : p}</option>)}
        </select>
        <input type="text" placeholder="Search issues..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 flex-1 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-colors" />
      </div>

      {issues.length === 0 ? (
        <p className="text-slate-400">Loading...</p>
      ) : (
        <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-slate-500 text-xs uppercase">
                <th className="text-left px-4 py-2.5">Key</th>
                <th className="text-left px-4 py-2.5">Title</th>
                <th className="text-left px-4 py-2.5">Status</th>
                <th className="text-left px-4 py-2.5">Priority</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((issue) => (
                <tr key={issue.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedIssue({ id: issue.id })}>
                  <td className="px-4 py-2.5 font-mono text-slate-400">{issue.key}</td>
                  <td className="px-4 py-2.5 text-slate-800">
                    <div>{issue.title}</div>
                    {issue.description && (
                      <div className="text-xs text-slate-400 mt-0.5 truncate max-w-md">{issue.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={issue.status} /></td>
                  <td className="px-4 py-2.5"><PriorityBadge priority={issue.priority} /></td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded-md text-slate-500">{issue.issueType}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">{issue.assignee || '-'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No matching issues</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {selectedIssue && (
        <DetailPanel entityType="issue" entityId={selectedIssue.id}
          onClose={() => setSelectedIssue(null)} onUpdated={loadIssues} />
      )}
    </div>
  );
}
