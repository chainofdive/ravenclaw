import { useEffect, useState } from 'react';
import { api, type WorkContext } from '../lib/api';
import { Card } from '../components/Card';

const typeColors: Record<string, string> = {
  technology: 'bg-sky-100 text-sky-700',
  domain: 'bg-violet-100 text-violet-700',
  process: 'bg-emerald-100 text-emerald-700',
};

export function Ontology() {
  const [ctx, setCtx] = useState<WorkContext | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getContext().then(setCtx).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!ctx) return <div className="p-6 text-slate-400">Loading...</div>;

  const { concepts, relations } = ctx.ontology;

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold text-slate-950">Ontology</h2>

      <Card title="Concepts">
        <div className="space-y-2">
          {concepts.map((c) => (
            <div key={c.id} className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-md ${typeColors[c.conceptType] || 'bg-gray-100 text-gray-600'}`}>
                {c.conceptType}
              </span>
              <span className="text-sm text-slate-700">{c.name}</span>
            </div>
          ))}
          {concepts.length === 0 && <p className="text-sm text-slate-400">No concepts</p>}
        </div>
      </Card>

      <Card title="Relations">
        {relations.length > 0 ? (
          <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-slate-500 text-xs uppercase">
                  <th className="text-left px-4 py-2">Source</th>
                  <th className="text-left px-4 py-2">Relation</th>
                  <th className="text-left px-4 py-2">Target</th>
                </tr>
              </thead>
              <tbody>
                {relations.map((r, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-gray-100/50 transition-colors">
                    <td className="px-4 py-2 text-slate-700">{r.sourceName}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-md">
                        {r.relationType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700">{r.targetName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No relations</p>
        )}
      </Card>
    </div>
  );
}
