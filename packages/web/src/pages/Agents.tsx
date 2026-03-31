import { useEffect, useState, useCallback } from 'react';
import { api, type AgentInfo, type WorkDirectiveInfo, type Project } from '../lib/api';
import { Card } from '../components/Card';
import { PendingInputs } from '../components/PendingInputs';

export function Agents() {
  const [workers, setWorkers] = useState<AgentInfo[]>([]);
  const [directives, setDirectives] = useState<WorkDirectiveInfo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');

  const [viewingLogs, setViewingLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logStatus, setLogStatus] = useState('');

  // New directive form
  const [instruction, setInstruction] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentType, setNewAgentType] = useState('claude-code');

  const load = useCallback(() => {
    api.listAgents().then(setWorkers).catch((e) => setError(e.message));
    api.listDirectives().then(setDirectives).catch(() => setDirectives([]));
    api.listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) return;
    try {
      await api.createAgent({ name: newAgentName.trim(), agentType: newAgentType });
      setNewAgentName('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteAgent = async (id: string) => {
    try {
      await api.deleteAgent(id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCreateDirective = async () => {
    if (!instruction.trim()) return;
    try {
      await api.createDirective({
        instruction: instruction.trim(),
        projectId: selectedProject || undefined,
      });
      setInstruction('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDispatch = async (directiveId: string) => {
    try {
      await api.dispatchDirective(directiveId);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleAutoDispatch = async () => {
    try {
      const result = await api.autoDispatch();
      if (!result.dispatched) {
        setError('No pending directives or idle workers available');
        setTimeout(() => setError(''), 3000);
      }
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleViewLogs = async (id: string) => {
    if (viewingLogs === id) {
      setViewingLogs(null);
      setLogs([]);
      return;
    }
    setViewingLogs(id);
    try {
      const result = await api.getDirectiveLogs(id);
      setLogs(result.logs);
      setLogStatus(result.status);
    } catch {
      setLogs(['(no logs available)']);
      setLogStatus('unknown');
    }
  };

  // Auto-refresh logs for running directives
  useEffect(() => {
    if (!viewingLogs) return;
    const directive = directives.find((d) => d.id === viewingLogs);
    if (!directive || directive.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const result = await api.getDirectiveLogs(viewingLogs);
        setLogs(result.logs);
        setLogStatus(result.status);
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [viewingLogs, directives]);

  const handleKillDirective = async (id: string) => {
    try {
      await api.killDirective(id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleCancelDirective = async (id: string) => {
    try {
      await api.cancelDirective(id);
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const statusColors: Record<string, string> = {
    idle: 'bg-gray-100 text-gray-600',
    running: 'bg-green-100 text-green-700',
    paused: 'bg-yellow-100 text-yellow-700',
    stopped: 'bg-red-100 text-red-700',
    error: 'bg-red-100 text-red-700',
    pending: 'bg-gray-100 text-gray-600',
    assigned: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  };

  const statusDots: Record<string, string> = {
    idle: 'bg-gray-400',
    running: 'bg-green-500',
    paused: 'bg-yellow-500',
    stopped: 'bg-red-500',
    error: 'bg-red-500',
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-slate-950">Agents & Directives</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Pending human inputs */}
      <PendingInputs />

      <div className="grid grid-cols-2 gap-6">
        {/* Workers Panel */}
        <Card title="Agents">
          <div className="space-y-3">
            {workers.map((w) => (
              <div key={w.id} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                <span className={`w-2.5 h-2.5 rounded-full ${statusDots[w.status] ?? 'bg-gray-400'}`} />
                <span className="text-sm font-medium text-slate-700">{w.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColors[w.status] ?? ''}`}>
                  {w.status}
                </span>
                <span className="text-xs text-slate-400">{w.agentType}</span>
                <button
                  onClick={() => handleDeleteAgent(w.id)}
                  className="text-xs text-slate-400 hover:text-red-500 ml-auto transition-colors"
                >
                  remove
                </button>
              </div>
            ))}
            {workers.length === 0 && (
              <p className="text-sm text-slate-400">No agents registered</p>
            )}

            <div className="flex gap-2 pt-2">
              <input
                type="text"
                value={newAgentName}
                onChange={(e) => setNewAgentName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateAgent()}
                placeholder="Agent name..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
              <select
                value={newAgentType}
                onChange={(e) => setNewAgentType(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
              >
                <option value="claude-code">Claude Code</option>
                <option value="gemini-cli">Gemini CLI</option>
                <option value="codex">Codex</option>
              </select>
              <button
                onClick={handleCreateAgent}
                disabled={!newAgentName.trim()}
                className="px-3 py-2 text-sm font-medium bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </Card>

        {/* Dispatch Panel */}
        <Card title="New Directive">
          <div className="space-y-3">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300"
            >
              <option value="">All projects</option>
              {projects.filter((p) => p.status !== 'cancelled').map((p) => (
                <option key={p.id} value={p.id}>{p.key}: {p.name}</option>
              ))}
            </select>

            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Describe the work to be done..."
              rows={4}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-300"
            />

            <div className="flex gap-2">
              <button
                onClick={handleCreateDirective}
                disabled={!instruction.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50 transition-colors"
              >
                Create Directive
              </button>
              <button
                onClick={handleAutoDispatch}
                className="px-4 py-2 text-sm font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
              >
                Auto-Dispatch
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Directives List */}
      <Card title="Directives">
        <div className="space-y-2">
          {directives.length === 0 && (
            <p className="text-sm text-slate-400">No directives yet</p>
          )}
          {directives.map((d) => {
            const project = projects.find((p) => p.id === d.projectId);
            const worker = workers.find((w) => w.id === d.assignedWorkerId);
            return (
              <div key={d.id} className="border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColors[d.status] ?? ''}`}>
                        {d.status}
                      </span>
                      {project && (
                        <span className="text-xs text-purple-500 font-mono">{project.key}</span>
                      )}
                      {worker && (
                        <span className="text-xs text-slate-500">agent: {worker.name}</span>
                      )}
                      <span className="text-xs text-slate-400 ml-auto">
                        {new Date(d.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700">{d.instruction}</p>
                    {d.result && (
                      <p className="text-xs text-slate-500 mt-1 bg-gray-50 rounded px-2 py-1">{d.result}</p>
                    )}
                  </div>
                  <div className="flex gap-1 ml-3 shrink-0">
                    {d.status === 'pending' && (
                      <button
                        onClick={() => handleDispatch(d.id)}
                        className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      >
                        Dispatch
                      </button>
                    )}
                    {d.status === 'running' && (
                      <button
                        onClick={() => handleKillDirective(d.id)}
                        className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                      >
                        Kill
                      </button>
                    )}
                    {(d.status === 'pending' || d.status === 'assigned' || d.status === 'running') && (
                      <button
                        onClick={() => handleCancelDirective(d.id)}
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => handleViewLogs(d.id)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        viewingLogs === d.id ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Logs
                    </button>
                  </div>
                </div>
                {viewingLogs === d.id && (
                  <div className="mt-2 bg-gray-900 rounded-lg p-3 max-h-80 overflow-y-auto font-mono text-xs">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${
                        logStatus === 'running' ? 'bg-green-800 text-green-200' :
                        logStatus === 'completed' ? 'bg-gray-700 text-gray-300' :
                        logStatus === 'failed' ? 'bg-red-800 text-red-200' :
                        'bg-gray-700 text-gray-400'
                      }`}>{logStatus || 'loading'}</span>
                      <span className="text-gray-500">{logs.length} lines</span>
                    </div>
                    {logs.length === 0 ? (
                      <p className="text-gray-500">No logs yet</p>
                    ) : (
                      logs.map((line, i) => (
                        <div key={i} className={`whitespace-pre-wrap ${
                          line.startsWith('[stderr]') ? 'text-red-400' :
                          line.startsWith('[error]') ? 'text-red-300' :
                          'text-green-300'
                        }`}>{line}</div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
