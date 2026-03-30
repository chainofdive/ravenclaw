import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import { api, type WorkContext } from '../lib/api';

function contextToMarkdown(ctx: WorkContext): string {
  let md = `# ${ctx.workspace.name}\n\n`;

  md += `## Epics\n\n`;
  for (const epic of ctx.epics) {
    md += `### ${epic.key}: ${epic.title}\n`;
    md += `- **Status**: ${epic.status} | **Priority**: ${epic.priority} | **Progress**: ${epic.progress}%\n`;
    md += `- ${epic.description}\n\n`;
    if (epic.issues.length > 0) {
      md += `| Key | Title | Status | Priority | Assignee |\n`;
      md += `|-----|-------|--------|----------|----------|\n`;
      for (const issue of epic.issues) {
        md += `| ${issue.key} | ${issue.title} | ${issue.status} | ${issue.priority} | ${issue.assignee || '-'} |\n`;
      }
      md += `\n`;
    }
  }

  md += `## Wiki Pages\n\n`;
  for (const page of ctx.wikiPages) {
    md += `- **${page.title}** (/${page.slug}) — ${page.summary}\n`;
  }
  md += `\n`;

  md += `## Ontology\n\n`;
  if (ctx.ontology.concepts.length > 0) {
    md += `**Concepts**: ${ctx.ontology.concepts.map((c) => `${c.name} (${c.conceptType})`).join(', ')}\n\n`;
  }
  if (ctx.ontology.relations.length > 0) {
    md += `**Relations**:\n`;
    for (const r of ctx.ontology.relations) {
      md += `- ${r.sourceName} → *${r.relationType.replace('_', ' ')}* → ${r.targetName}\n`;
    }
  }

  return md;
}

export function Context() {
  const [ctx, setCtx] = useState<WorkContext | null>(null);
  const [compact, setCompact] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getContext().then(setCtx).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!ctx) return <div className="p-6 text-slate-400">Loading...</div>;

  const md = contextToMarkdown(ctx);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-950">Work Context</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCompact(!compact)}
            className="px-3 py-1.5 text-sm bg-gray-100 text-slate-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {compact ? 'Full View' : 'Compact'}
          </button>
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-500 transition-colors"
          >
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-100 p-6">
        {compact ? (
          <pre className="text-sm text-slate-600 whitespace-pre-wrap font-mono overflow-auto max-h-[60vh] bg-gray-50 rounded-lg p-4">
            {md}
          </pre>
        ) : (
          <div className="prose prose-sm max-w-none
            prose-headings:text-slate-800 prose-p:text-slate-600
            prose-a:text-teal-600 prose-code:text-teal-700
            prose-strong:text-slate-800 prose-li:text-slate-600
            prose-th:text-slate-700 prose-td:text-slate-600
            prose-table:border-gray-200 prose-pre:bg-gray-50">
            <Markdown>{md}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
