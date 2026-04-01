import { useEffect, useState, useCallback, useRef } from 'react';
import { api, type AgentInfo } from '../lib/api';
import { FilePreview, parseFileLinks } from './FilePreview';

interface Props {
  projectId: string;
  projectKey: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  streaming?: boolean;
}

export function CommandPanel({ projectId, projectKey }: Props) {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load agents
  useEffect(() => {
    api.listAgents().then(setAgents).catch(() => {});
  }, []);

  // Load conversation history
  useEffect(() => {
    api.getConversationHistory(projectId).then((data) => {
      setMessages(data.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: m.timestamp,
      })));
      setIsProcessing(data.isProcessing);
    }).catch(() => {});
  }, [projectId]);

  // SSE connection for streaming
  useEffect(() => {
    const es = new EventSource(`/api/v1/conversations/${encodeURIComponent(projectId)}/stream`);
    eventSourceRef.current = es;

    es.addEventListener('stream', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.done) {
          // Response complete — move streaming text to messages
          setStreamingText((prev) => {
            if (prev.trim()) {
              setMessages((msgs) => [
                ...msgs.filter((m) => !m.streaming),
                { role: 'assistant', content: prev, timestamp: new Date().toISOString() },
              ]);
            }
            return '';
          });
          setIsProcessing(false);
        } else if (data.text) {
          setStreamingText((prev) => prev + data.text);
        }
      } catch { /* ignore */ }
    });

    es.addEventListener('open', () => setConnected(true));
    es.addEventListener('error', () => setConnected(false));

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
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

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
    ]);

    try {
      await api.sendConversationMessage(projectId, message, selectedAgent || undefined);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `[Error] ${err.message}`, timestamp: new Date().toISOString() },
      ]);
      setIsProcessing(false);
    }
  }, [input, isProcessing, projectId, selectedAgent]);

  const handleStop = async () => {
    try {
      await api.stopConversation(projectId);
      setIsProcessing(false);
    } catch { /* ignore */ }
  };

  const handleClear = async () => {
    try {
      await api.clearConversation(projectId);
      setMessages([]);
      setStreamingText('');
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

  const idleAgents = agents.filter((a) => a.status === 'idle');

  return (
    <div className="flex flex-col h-full px-3 py-2">
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
              msg.role === 'user'
                ? 'bg-teal-500 text-white'
                : 'bg-gray-100 text-slate-800'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="whitespace-pre-wrap"><FileLinkedText text={msg.content} /></div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
              <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-teal-200' : 'text-slate-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {/* Streaming response */}
        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm bg-gray-100 text-slate-800">
              <div className="whitespace-pre-wrap"><FileLinkedText text={streamingText} /></div>
              <span className="inline-block w-2 h-4 bg-teal-500 animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {/* Processing indicator (no streaming yet) */}
        {isProcessing && !streamingText && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3.5 py-2.5 bg-gray-100">
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                Thinking...
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-200 pt-2 space-y-2 shrink-0">
        <div className="flex items-center gap-2 text-xs">
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-teal-300"
          >
            <option value="">Auto agent</option>
            {idleAgents.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.agentType})</option>
            ))}
          </select>
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-slate-400">{connected ? 'connected' : 'disconnected'}</span>
          {messages.length > 0 && (
            <button onClick={handleClear} className="ml-auto text-slate-400 hover:text-red-500 transition-colors">
              Clear
            </button>
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
            placeholder={`Message ${projectKey}... (Enter to send)`}
            rows={2}
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 resize-none bg-white focus:outline-none focus:ring-2 focus:ring-teal-300"
            disabled={isProcessing}
          />
          {isProcessing ? (
            <button
              onClick={handleStop}
              className="px-4 py-2.5 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors self-end"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-2.5 text-sm font-medium bg-teal-500 text-white rounded-xl hover:bg-teal-600 disabled:opacity-50 transition-colors self-end"
            >
              Send
            </button>
          )}
        </div>
      </div>

      {previewFile && (
        <FilePreview path={previewFile} projectId={projectId} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}
