import { useEffect, useState, useCallback } from 'react';
import { api, type HumanInputRequestInfo } from '../lib/api';

interface Props {
  projectId?: string;
  pollInterval?: number;
}

export function PendingInputs({ projectId, pollInterval = 10000 }: Props) {
  const [requests, setRequests] = useState<HumanInputRequestInfo[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  const load = useCallback(() => {
    if (projectId) {
      api.listInputRequests(projectId).then((all) =>
        setRequests(all.filter((r) => r.status === 'waiting')),
      ).catch(() => {});
    } else {
      api.listWaitingInputs().then(setRequests).catch(() => {});
    }
  }, [projectId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, pollInterval);
    return () => clearInterval(interval);
  }, [load, pollInterval]);

  const handleAnswer = async (id: string) => {
    const answer = answers[id]?.trim();
    if (!answer) return;
    setSubmitting(id);
    try {
      await api.answerInput(id, answer, 'user');
      setAnswers((prev) => ({ ...prev, [id]: '' }));
      load();
    } catch {
      // ignore
    }
    setSubmitting(null);
  };

  const handleCancel = async (id: string) => {
    try {
      await api.cancelInput(id);
      load();
    } catch {
      // ignore
    }
  };

  const handleOptionClick = async (id: string, option: string) => {
    setSubmitting(id);
    try {
      await api.answerInput(id, option, 'user');
      load();
    } catch {
      // ignore
    }
    setSubmitting(null);
  };

  if (requests.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500" />
        </span>
        <h3 className="text-sm font-semibold text-orange-700">
          Pending Input ({requests.length})
        </h3>
      </div>

      {requests.map((req) => {
        const age = Math.round((Date.now() - new Date(req.createdAt).getTime()) / 60000);

        return (
          <div key={req.id} className="border-2 border-orange-200 bg-orange-50 rounded-xl p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  req.urgency === 'blocking' ? 'bg-red-100 text-red-700' :
                  req.urgency === 'normal' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{req.urgency}</span>
                <span className="text-xs text-slate-500">{req.agentName}</span>
                <span className="text-xs text-slate-400">{age}m ago</span>
              </div>
              <button
                onClick={() => handleCancel(req.id)}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                title="Cancel request"
              >
                dismiss
              </button>
            </div>

            {/* Question */}
            <p className="text-sm font-medium text-slate-800">{req.question}</p>

            {/* Context */}
            {req.context && (
              <p className="text-xs text-slate-600 bg-white/60 rounded-lg p-2 whitespace-pre-wrap">{req.context}</p>
            )}

            {/* Option buttons */}
            {req.options && req.options.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {req.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleOptionClick(req.id, opt)}
                    disabled={submitting === req.id}
                    className="px-3 py-1.5 text-sm bg-white border border-orange-300 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            {/* Free-text answer */}
            <div className="flex gap-2">
              <input
                type="text"
                value={answers[req.id] || ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [req.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && handleAnswer(req.id)}
                placeholder="Type your answer..."
                className="flex-1 text-sm border border-orange-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
                disabled={submitting === req.id}
              />
              <button
                onClick={() => handleAnswer(req.id)}
                disabled={submitting === req.id || !answers[req.id]?.trim()}
                className="px-4 py-2 text-sm font-medium bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                {submitting === req.id ? '...' : 'Answer'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
