import { useEffect, useState, useCallback } from 'react';
import { api, type AgentInfo, type WorkDirectiveInfo, type Project } from '../lib/api';
import { Card } from '../components/Card';
import { PendingInputs } from '../components/PendingInputs';

export function Agents() {
  const [workers, setWorkers] = useState<AgentInfo[]>([]);
  const [directives, setDirectives] = useState<WorkDirectiveInfo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');

  // New directive form
  const [instruction, setInstruction] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [newWorkerName, setNewWorkerName] = useState('');

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

  const handleCreateWorker = async () => {
    if (!newWorkerName.trim()) return;
    try {
      await api.createAgent({ name: newWorkerName.trim() });
      setNewWorkerName('');
      load();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleDeleteWorker = async (id: string) => {
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
                  onClick={() => handleDeleteWorker(w.id)}
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
                value={newWorkerName}
                onChange={(e) => setNewWorkerName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateWorker()}
                placeholder="Agent name..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
              <button
                onClick={handleCreateWorker}
                disabled={!newWorkerName.trim()}
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
                        <span className="text-xs text-slate-500">worker: {worker.name}</span>
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
                    {(d.status === 'pending' || d.status === 'assigned' || d.status === 'running') && (
                      <button
                        onClick={() => handleCancelDirective(d.id)}
                        className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
