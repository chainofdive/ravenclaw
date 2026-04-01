import { useEffect, useState, useCallback, useRef } from 'react';
import { api, type AgentInfo, type WorkDirectiveInfo } from '../lib/api';
import { FilePreview, parseFileLinks } from './FilePreview';

interface Props {
  projectId: string;
  projectKey: string;
}

export function CommandPanel({ projectId, projectKey }: Props) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [directives, setDirectives] = useState<WorkDirectiveInfo[]>([]);
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api.listAgents().then(setAgents).catch(() => {});
    api.listDirectives(projectId).then(setDirectives).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  // Auto-refresh logs for running directive
  useEffect(() => {
    if (!expandedLogs) return;
    const d = directives.find((d) => d.id === expandedLogs);
    if (!d || (d.status !== 'running' && d.status !== 'assigned')) return;

    const interval = setInterval(async () => {
      try {
        const result = await api.getDirectiveLogs(expandedLogs);
        setLogs(result.logs);
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [expandedLogs, directives]);

  const handleSend = async () => {
    if (!input.trim()) return;
    setSending(true);
    try {
      // Create directive
      const directive = await api.createDirective({
        instruction: input.trim(),
        projectId,
      });

      // Auto-dispatch to selected or idle agent
      try {
        if (selectedAgent) {
          await api.dispatchDirective(directive.id, selectedAgent);
        } else {
          await api.dispatchDirective(directive.id);
        }
      } catch {
        // No idle agent — stays pending
      }

      setInput('');
      load();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 200);
    } catch {
      // ignore
    }
    setSending(false);
  };

  const handleViewLogs = async (id: string) => {
    if (expandedLogs === id) {
      setExpandedLogs(null);
      setLogs([]);
      return;
    }
    setExpandedLogs(id);
    try {
      const result = await api.getDirectiveLogs(id);
      setLogs(result.logs);
    } catch {
      setLogs([]);
    }
  };

  const handleKill = async (id: string) => {
    try {
      await api.killDirective(id);
      load();
    } catch { /* ignore */ }
  };

  const FileLinkedText = ({ text, className }: { text: string; className?: string }) => {
    const segments = parseFileLinks(text);
    const hasFiles = segments.some((s) => s.type === 'file');
    if (!hasFiles) return <span className={className}>{text}</span>;

    return (
      <span className={className}>
        {segments.map((seg, i) =>
          seg.type === 'file' ? (
            <button
              key={i}
              onClick={() => setPreviewFile(seg.value)}
              className="inline-flex items-center gap-1 px-1 py-0.5 bg-teal-50 text-teal-700 rounded hover:bg-teal-100 transition-colors font-mono text-xs"
              title={seg.value}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {seg.value.split('/').pop()}
            </button>
          ) : (
            <span key={i}>{seg.value}</span>
          ),
        )}
      </span>
    );
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✓';
      case 'running': return '●';
      case 'assigned': return '◐';
      case 'pending': return '○';
      case 'failed': return '✗';
      case 'cancelled': return '—';
      default: return '?';
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-500';
      case 'running': return 'text-blue-500 animate-pulse';
      case 'assigned': return 'text-blue-400';
      case 'pending': return 'text-gray-400';
      case 'failed': return 'text-red-500';
      case 'cancelled': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const idleAgents = agents.filter((a) => a.status === 'idle');

  return (
    <div className="flex flex-col h-full px-3 py-2">
      {/* Directive history — scrollable */}
      <div className="flex-1 overflow-y-auto space-y-2 pb-2">
        {directives.length === 0 && (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            No directives yet. Type an instruction below to get started.
          </div>
        )}
        {[...directives].reverse().map((d) => {
          const agent = agents.find((a) => a.id === d.assignedWorkerId);
          return (
            <div key={d.id} className="group">
              {/* Directive bubble */}
              <div className="flex gap-3">
                <span className={`mt-1 text-lg ${statusColor(d.status)}`}>
                  {statusIcon(d.status)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {agent && <span className="text-xs text-teal-600">{agent.name}</span>}
                        <span className="text-xs text-gray-400">
                          {new Date(d.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {d.status === 'running' && (
                          <button
                            onClick={() => handleKill(d.id)}
                            className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded hover:bg-red-200"
                          >
                            Stop
                          </button>
                        )}
                        <button
                          onClick={() => handleViewLogs(d.id)}
                          className={`text-xs px-1.5 py-0.5 rounded ${
                            expandedLogs === d.id ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}
                        >
                          Logs
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap"><FileLinkedText text={d.instruction} /></p>
                    {d.result && d.status === 'completed' && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs text-emerald-600 font-medium mb-1">Result</p>
                        <p className="text-xs text-slate-600 whitespace-pre-wrap max-h-32 overflow-y-auto"><FileLinkedText text={d.result} /></p>
                      </div>
                    )}
                    {d.result && d.status === 'failed' && (
                      <div className="mt-2 pt-2 border-t border-red-100">
                        <p className="text-xs text-red-600 font-medium mb-1">Error</p>
                        <p className="text-xs text-red-500 whitespace-pre-wrap max-h-20 overflow-y-auto"><FileLinkedText text={d.result} /></p>
                      </div>
                    )}
                  </div>

                  {/* Inline logs */}
                  {expandedLogs === d.id && (
                    <div className="mt-1 bg-gray-900 rounded-lg p-3 max-h-60 overflow-y-auto font-mono text-xs">
                      {logs.length === 0 ? (
                        <p className="text-gray-500">No logs available</p>
                      ) : (
                        <>
                          {logs.map((line, i) => (
                            <div key={i} className={`whitespace-pre-wrap ${
                              line.startsWith('[stderr]') ? 'text-red-400' :
                              line.startsWith('[error]') ? 'text-red-300' :
                              'text-green-300'
                            }`}><FileLinkedText text={line} /></div>
                          ))}
                          <div ref={logEndRef} />
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-200 pt-3 space-y-2">
        <div className="flex gap-2 items-center">
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
          >
            <option value="">Auto (idle agent)</option>
            {idleAgents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {idleAgents.length === 0 && (
            <span className="text-xs text-orange-500">No idle agents</span>
          )}
        </div>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Instruct agent on ${projectKey}... (Enter to send, Shift+Enter for newline)`}
            rows={2}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
            disabled={sending}
          />
          <button
            onClick={handleSend}
            disabled={sending || !input.trim()}
            className="px-5 py-2.5 text-sm font-medium bg-teal-500 text-white rounded-xl hover:bg-teal-600 disabled:opacity-50 transition-colors self-end"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>

      {/* File preview modal */}
      {previewFile && (
        <FilePreview path={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}
