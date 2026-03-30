import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { api, type WikiPage } from '../lib/api';

export function Wiki() {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [selected, setSelected] = useState<WikiPage | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.listWikiPages()
      .then((data) => {
        setPages(data);
        if (data.length > 0) setSelected(data[0]);
      })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (pages.length === 0) return <div className="p-6 text-slate-400">Loading...</div>;

  return (
    <div className="flex h-full">
      <div className="w-56 bg-gray-50 border-r border-gray-200 py-4 shrink-0 overflow-y-auto">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => setSelected(page)}
            className={`w-full text-left px-4 py-2 text-sm transition-colors ${
              selected?.id === page.id
                ? 'bg-teal-50 text-teal-700'
                : 'text-slate-500 hover:text-slate-700 hover:bg-gray-100'
            }`}
          >
            <div className="font-medium">{page.title}</div>
            <div className="text-xs text-slate-400 font-mono mt-0.5">/{page.slug}</div>
          </button>
        ))}
      </div>

      <div className="flex-1 p-6 overflow-y-auto bg-white">
        {selected ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              {selected.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 rounded-md text-slate-500">
                  {tag}
                </span>
              ))}
              <span className="text-xs text-slate-400 ml-auto">v{selected.version}</span>
            </div>
            <div className="prose prose-sm max-w-none
              prose-headings:text-slate-800 prose-p:text-slate-600
              prose-a:text-teal-600 prose-code:text-teal-700
              prose-strong:text-slate-800 prose-li:text-slate-600
              prose-th:text-slate-700 prose-td:text-slate-600
              prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200">
              <Markdown>{selected.content}</Markdown>
            </div>
          </>
        ) : (
          <p className="text-slate-400">Select a page</p>
        )}
      </div>
    </div>
  );
}
