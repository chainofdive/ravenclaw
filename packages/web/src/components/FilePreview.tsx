import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getApiKey } from '../lib/api';

interface Props {
  path: string;
  projectId?: string;
  onClose: () => void;
}

const API_BASE = '/api/v1';

function getExt(path: string): string {
  const dot = path.lastIndexOf('.');
  return dot >= 0 ? path.substring(dot).toLowerCase() : '';
}

function getFileName(path: string): string {
  return path.split('/').pop() || path;
}

export function FilePreview({ path, projectId, onClose }: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const ext = getExt(path);
  const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext);
  const isPdf = ext === '.pdf';
  const isText = ['.md', '.txt', '.json', '.html', '.css', '.js', '.ts', '.tsx', '.yaml', '.yml', '.toml', '.log', '.csv'].includes(ext);
  const isMarkdown = ext === '.md';

  useEffect(() => {
    const params = new URLSearchParams({ path });
    if (projectId) params.set('project_id', projectId);
    const url = `${API_BASE}/files?${params.toString()}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${getApiKey()}`,
    };

    setLoading(true);
    setError('');

    if (isImage || isPdf) {
      fetch(url, { headers })
        .then((res) => {
          if (!res.ok) throw new Error(`${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          setBlobUrl(URL.createObjectURL(blob));
          setLoading(false);
        })
        .catch((e) => {
          setError(`Failed to load: ${e.message}`);
          setLoading(false);
        });
    } else if (isText) {
      fetch(url, { headers })
        .then((res) => {
          if (!res.ok) throw new Error(`${res.status}`);
          return res.text();
        })
        .then((text) => {
          setContent(text);
          setLoading(false);
        })
        .catch((e) => {
          setError(`Failed to load: ${e.message}`);
          setLoading(false);
        });
    } else {
      setError(`Unsupported file type: ${ext}`);
      setLoading(false);
    }

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [path]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono uppercase">{ext.replace('.', '')}</span>
            <span className="text-sm font-medium text-slate-800 truncate">{getFileName(path)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-mono truncate max-w-xs hidden sm:block">{path}</span>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-gray-100 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5">
          {loading && (
            <div className="flex items-center justify-center h-32 text-slate-400">Loading...</div>
          )}

          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}

          {/* Markdown */}
          {!loading && !error && isMarkdown && content !== null && (
            <div className="prose prose-sm max-w-none prose-slate prose-headings:text-slate-800 prose-a:text-teal-600">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}

          {/* Plain text / code */}
          {!loading && !error && isText && !isMarkdown && content !== null && (
            <pre className="text-sm font-mono text-slate-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-4 overflow-auto">{content}</pre>
          )}

          {/* Image */}
          {!loading && !error && isImage && blobUrl && (
            <div className="flex items-center justify-center">
              <img src={blobUrl} alt={getFileName(path)} className="max-w-full max-h-[70vh] rounded-lg shadow-sm" />
            </div>
          )}

          {/* PDF */}
          {!loading && !error && isPdf && blobUrl && (
            <iframe src={blobUrl} className="w-full h-[70vh] rounded-lg border border-gray-200" />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Parse text for file paths and return segments with file links.
 */
export function parseFileLinks(text: string): Array<{ type: 'text' | 'file'; value: string }> {
  // Match file paths — absolute (/path/to/file.md) or relative (./path/to/file.md, path/to/file.md)
  const fileRegex = /((?:\.{0,2}\/)?[\w./-]+\.(md|txt|png|jpg|jpeg|gif|svg|webp|pdf|json|html|css|js|ts|tsx|yaml|yml|csv))\b/gi;

  const segments: Array<{ type: 'text' | 'file'; value: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = fileRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.substring(lastIndex, match.index) });
    }
    segments.push({ type: 'file', value: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.substring(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }];
}
