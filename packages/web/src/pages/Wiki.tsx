import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';
import 'highlight.js/styles/github.css';
import { api, type WikiPage } from '../lib/api';

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-slate-900 border-b border-gray-200 pb-2 mb-4">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold text-slate-800 mt-6 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold text-slate-700 mt-4 mb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold text-slate-700 mt-3 mb-1">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-slate-700 leading-relaxed mb-4">{children}</p>
  ),
  a: ({ href, children }) => (
    <a href={href} className="text-teal-600 hover:text-teal-800 underline">{children}</a>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-slate-800">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-slate-600">{children}</em>
  ),
  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-gray-100 text-teal-700 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
      );
    }
    return <code className={className} {...props}>{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto mb-4 text-sm font-mono">{children}</pre>
  ),
  table: ({ children }) => (
    <table className="w-full border-collapse mb-4">{children}</table>
  ),
  thead: ({ children }) => (
    <thead>{children}</thead>
  ),
  th: ({ children }) => (
    <th className="bg-gray-50 text-left text-sm font-semibold text-slate-700 px-4 py-2 border-b-2 border-gray-200">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2 border-b border-gray-100 text-sm text-slate-600">{children}</td>
  ),
  tr: ({ children }) => (
    <tr className="even:bg-gray-50">{children}</tr>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-6 mb-4 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 mb-4 space-y-1">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-slate-700">{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-teal-300 bg-teal-50/30 pl-4 py-2 italic text-slate-600 mb-4">{children}</blockquote>
  ),
  hr: () => (
    <hr className="border-gray-200 my-6" />
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt} className="max-w-full rounded-lg shadow-sm" />
  ),
  input: ({ type, checked, ...props }) => {
    if (type === 'checkbox') {
      return (
        <input
          type="checkbox"
          checked={checked}
          readOnly
          className="mr-2 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
          {...props}
        />
      );
    }
    return <input type={type} checked={checked} {...props} />;
  },
  del: ({ children }) => (
    <del className="line-through text-slate-400">{children}</del>
  ),
};

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
            <div className="max-w-none">
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={markdownComponents}
              >
                {selected.content}
              </Markdown>
            </div>
          </>
        ) : (
          <p className="text-slate-400">Select a page</p>
        )}
      </div>
    </div>
  );
}
