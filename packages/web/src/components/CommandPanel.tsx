import { useEffect, useState, useCallback, useRef } from 'react';
import { api, type AgentInfo, getApiKey } from '../lib/api';
import { FilePreview, parseFileLinks } from './FilePreview';

interface Props {
  projectId: string;
  projectKey: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface ConversationInfo {
  id: string;
  title: string | null;
  agentType: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
}

export function CommandPanel({ projectId, projectKey }: Props) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [convList, setConvList] = useState<ConversationInfo[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [activity, setActivity] = useState('');
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [showConvPicker, setShowConvPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load agents + conversation list
  useEffect(() => {
    api.listAgents().then(setAgents).catch(() => {});
    api.listConversations(projectId).then(setConvList).catch(() => {});
  }, [projectId]);

  // Load conversation history
  const loadHistory = useCallback((convId?: string) => {
    api.getConversationHistory(projectId, convId).then((data) => {
      setActiveConvId(data.conversationId);
      setMessages(data.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: m.createdAt,
      })));
      setIsProcessing(data.isProcessing);
    }).catch(() => {});
  }, [projectId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // SSE connection
  useEffect(() => {
    const es = new EventSource(`/api/v1/conversations/${encodeURIComponent(projectId)}/stream?token=${encodeURIComponent(getApiKey())}`);
    eventSourceRef.current = es;

    es.addEventListener('stream', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.done) {
          setStreamingText((prev) => {
            if (prev.trim()) {
              setMessages((msgs) => [
                ...msgs,
                { role: 'assistant', content: prev, createdAt: new Date().toISOString() },
              ]);
            }
            return '';
          });
          setIsProcessing(false);
          setActivity('');
          api.listConversations(projectId).then(setConvList).catch(() => {});
        } else if (data.text) {
          setStreamingText((prev) => prev + data.text);
          setActivity(''); // Clear activity when text arrives
        }
      } catch { /* ignore */ }
    });

    es.addEventListener('status', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.activity) setActivity(data.activity);
      } catch { /* ignore */ }
    });

    es.addEventListener('open', () => setConnected(true));
    es.addEventListener('error', () => setConnected(false));

    return () => { es.close(); };
  }, [projectId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isProcessing) return;

    const message = input.trim();
    setInput('');
    setIsProcessing(true);
    setStreamingText('');
    setActivity('');
    setMessages((prev) => [...prev, { role: 'user', content: message, createdAt: new Date().toISOString() }]);

    try {
      const result = await api.sendConversationMessage(projectId, message, activeConvId ?? undefined, selectedAgent || undefined);
      if (result.conversationId && !activeConvId) {
        setActiveConvId(result.conversationId);
      }
    } catch (err: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `[Error] ${err.message}`, createdAt: new Date().toISOString() }]);
      setIsProcessing(false);
    }
  }, [input, isProcessing, projectId, activeConvId, selectedAgent]);

  const handleNewConversation = async () => {
    try {
      const result = await api.newConversation(projectId, selectedAgent || undefined);
      setActiveConvId(result.id);
      setMessages([]);
      setStreamingText('');
      setShowConvPicker(false);
      api.listConversations(projectId).then(setConvList).catch(() => {});
    } catch { /* ignore */ }
  };

  const handleSwitchConversation = (convId: string) => {
    setActiveConvId(convId);
    setStreamingText('');
    loadHistory(convId);
    setShowConvPicker(false);
  };

  const handleStop = async () => {
    try { await api.stopConversation(projectId); setIsProcessing(false); } catch { /* ignore */ }
  };

  const FileLinkedText = ({ text, className }: { text: string; className?: string }) => {
    const segments = parseFileLinks(text);
    if (!segments.some((s) => s.type === 'file')) return <span className={className}>{text}</span>;
    return (
      <span className={className}>
        {segments.map((seg, i) =>
          seg.type === 'file' ? (
            <button key={i} onClick={() => setPreviewFile(seg.value)}
              className="inline-flex items-center gap-1 px-1 py-0.5 bg-teal-50 text-teal-700 rounded hover:bg-teal-100 transition-colors font-mono text-xs" title={seg.value}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {seg.value.split('/').pop()}
            </button>
          ) : <span key={i}>{seg.value}</span>,
        )}
      </span>
    );
  };

  const activeConv = convList.find((c) => c.id === activeConvId);

  return (
    <div className="flex flex-col h-full px-3 py-2">
      {/* Session selector bar */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100 mb-2 shrink-0">
        <button
          onClick={() => setShowConvPicker(!showConvPicker)}
          className="flex-1 text-left text-xs truncate px-2 py-1.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {activeConv ? (
            <span>{activeConv.title || 'Untitled'} <span className="text-slate-400">({activeConv.agentType})</span></span>
          ) : (
            <span className="text-slate-400">Select conversation...</span>
          )}
        </button>
        <button
          onClick={handleNewConversation}
          className="shrink-0 text-xs px-2 py-1.5 bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors"
          title="New conversation"
        >
          + New
        </button>
      </div>

      {/* Conversation picker dropdown */}
      {showConvPicker && convList.length > 0 && (
        <div className="mb-2 border border-gray-200 rounded-lg bg-white shadow-lg max-h-40 overflow-y-auto shrink-0">
          {convList.map((c) => (
            <button
              key={c.id}
              onClick={() => handleSwitchConversation(c.id)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 border-b border-gray-50 last:border-0 ${
                c.id === activeConvId ? 'bg-teal-50 text-teal-700' : 'text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{c.title || 'Untitled'}</span>
                <span className="text-slate-400 shrink-0 ml-2">{new Date(c.updatedAt).toLocaleDateString()}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.length === 0 && !streamingText && (
          <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
            Start a conversation with your agent.
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
              msg.role === 'user' ? 'bg-teal-500 text-white' : 'bg-gray-100 text-slate-800'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="whitespace-pre-wrap"><FileLinkedText text={msg.content} /></div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
              <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-teal-200' : 'text-slate-400'}`}>
                {new Date(msg.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm bg-gray-100 text-slate-800">
              <div className="whitespace-pre-wrap"><FileLinkedText text={streamingText} /></div>
              <span className="inline-block w-2 h-4 bg-teal-500 animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {isProcessing && !streamingText && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3.5 py-2.5 bg-gray-100">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                {activity || 'Thinking...'}
              </div>
            </div>
          </div>
        )}

        {/* Activity indicator while streaming (tool use during response) */}
        {isProcessing && streamingText && activity && (
          <div className="flex justify-start">
            <div className="rounded-lg px-2.5 py-1.5 bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-1.5 text-xs text-blue-600">
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {activity}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-200 pt-2 space-y-2 shrink-0">
        <div className="flex items-center gap-2 text-xs">
          <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-300">
            <option value="">Auto agent</option>
            {agents.filter((a) => a.status === 'idle').map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.agentType})</option>
            ))}
          </select>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-slate-400">{connected ? 'connected' : 'disconnected'}</span>
        </div>
        <div className="flex gap-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Message ${projectKey}... (Enter to send)`}
            rows={2}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
            disabled={isProcessing} />
          {isProcessing ? (
            <button onClick={handleStop} className="px-4 py-2.5 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors self-end">Stop</button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()} className="px-4 py-2.5 text-sm font-medium bg-teal-500 text-white rounded-xl hover:bg-teal-600 disabled:opacity-50 transition-colors self-end">Send</button>
          )}
        </div>
      </div>

      {previewFile && <FilePreview path={previewFile} projectId={projectId} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}
