import { useEffect, useState } from 'react';
import { api, type Comment } from '../lib/api';

interface CommentPanelProps {
  entityType: 'epic' | 'issue' | 'wiki_page' | 'concept';
  entityId: string;
}

export function CommentPanel({ entityType, entityId }: CommentPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadComments = async () => {
    try {
      const data = await api.listComments(entityType, entityId);
      setComments(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadComments();
  }, [entityType, entityId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      await api.addComment({ entityType, entityId, content: content.trim() });
      setContent('');
      await loadComments();
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // silently fail
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Comments {!loading && comments.length > 0 && `(${comments.length})`}
      </h4>

      {loading ? (
        <p className="text-xs text-slate-400">Loading comments...</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {comments.length === 0 && (
            <p className="text-xs text-slate-400">No comments yet</p>
          )}
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-gray-50 rounded-lg px-3 py-2 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-teal-700">
                    {comment.author}
                  </span>
                  <span className="text-xs text-slate-400">
                    {formatTime(comment.createdAt)}
                  </span>
                </div>
                {comment.author === 'user' && (
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="text-xs text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 transition-colors"
        />
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? '...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
