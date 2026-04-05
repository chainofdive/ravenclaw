import { useEffect, useState, useCallback } from 'react';
import { api, type Project, type Epic, type Issue } from '../lib/api';
import { StatusBadge } from './StatusBadge';
import { PriorityBadge } from './PriorityBadge';
import { CommentPanel } from './CommentPanel';

type EntityType = 'project' | 'epic' | 'issue';

interface Props {
  entityType: EntityType;
  entityId: string;
  onClose: () => void;
  onUpdated?: () => void;
}

export function DetailPanel({ entityType, entityId, onClose, onUpdated }: Props) {
  const [entity, setEntity] = useState<Project | Epic | Issue | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (entityType === 'project') setEntity(await api.getProject(entityId));
      else if (entityType === 'epic') setEntity(await api.getEpic(entityId));
      else setEntity(await api.getIssue(entityId));
    } catch { /* ignore */ }
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => { load(); }, [load]);

  const save = async (field: string, value: string) => {
    setSaving(true);
    try {
      const data = { [field]: value };
      if (entityType === 'project') await api.updateProject(entityId, data);
      else if (entityType === 'epic') await api.updateEpic(entityId, data);
      else await api.updateIssue(entityId, data);
      setEditing(null);
      await load();
      onUpdated?.();
    } catch { /* ignore */ }
    setSaving(false);
  };

  const startEdit = (field: string, currentValue: string) => {
    setEditing(field);
    setEditValue(currentValue || '');
  };

  const cancelEdit = () => { setEditing(null); setEditValue(''); };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={onClose}>
        <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <span className="text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (!entity) return null;

  const isProject = entityType === 'project';
  const titleField = isProject ? 'name' : 'title';
  const titleValue = isProject ? (entity as Project).name : (entity as Epic | Issue).title;
  const key = isProject ? (entity as Project).key : (entity as Epic | Issue).key;
  const description = entity.description || '';
  const status = isProject ? (entity as Project).status : (entity as Epic | Issue).status;
  const priority = isProject ? (entity as Project).priority : (entity as Epic | Issue).priority;

  const EditableField = ({ field, value, label, multiline }: { field: string; value: string; label: string; multiline?: boolean }) => {
    if (editing === field) {
      return (
        <div className="space-y-2">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
          {multiline ? (
            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)}
              className="w-full text-sm border border-teal-300 rounded-lg px-3 py-2 min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-teal-300"
              autoFocus />
          ) : (
            <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
              className="w-full text-sm border border-teal-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300"
              autoFocus onKeyDown={(e) => { if (e.key === 'Enter') save(field, editValue); if (e.key === 'Escape') cancelEdit(); }} />
          )}
          <div className="flex gap-2">
            <button onClick={() => save(field, editValue)} disabled={saving}
              className="px-3 py-1 text-xs bg-teal-500 text-white rounded-lg hover:bg-teal-600 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onClick={cancelEdit} className="px-3 py-1 text-xs bg-gray-100 text-slate-600 rounded-lg hover:bg-gray-200">Cancel</button>
          </div>
        </div>
      );
    }
    return (
      <div className="group">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</label>
        <div onClick={() => startEdit(field, value)}
          className="mt-1 text-sm text-slate-700 whitespace-pre-wrap cursor-pointer rounded-lg px-3 py-2 -mx-3 hover:bg-gray-50 transition-colors min-h-[2rem]">
          {value || <span className="text-slate-300 italic">Click to add {label.toLowerCase()}...</span>}
          <span className="invisible group-hover:visible text-slate-300 text-xs ml-2">edit</span>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-lg bg-white h-full shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="shrink-0 border-b border-gray-200 px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded">{key}</span>
              <span className="text-xs text-slate-400 uppercase">{entityType}</span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} />
            <PriorityBadge priority={priority} />
            {entityType === 'issue' && (
              <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{(entity as Issue).issueType}</span>
            )}
            {entityType === 'epic' && (
              <span className="text-xs text-slate-500">{(entity as Epic).progress}% complete</span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <EditableField field={titleField} value={titleValue} label={isProject ? 'Name' : 'Title'} />
          <EditableField field="description" value={description} label="Description" multiline />

          {/* Metadata fields */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            {entityType === 'issue' && (entity as Issue).assignee && (
              <div>
                <span className="text-slate-500 uppercase tracking-wide">Assignee</span>
                <div className="mt-1 text-slate-700">{(entity as Issue).assignee}</div>
              </div>
            )}
            {entityType === 'issue' && (entity as Issue).labels?.length > 0 && (
              <div>
                <span className="text-slate-500 uppercase tracking-wide">Labels</span>
                <div className="mt-1 flex gap-1 flex-wrap">
                  {(entity as Issue).labels.map((l, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 text-slate-600 rounded-full">{l}</span>
                  ))}
                </div>
              </div>
            )}
            {entityType === 'issue' && (entity as Issue).estimatedHours && (
              <div>
                <span className="text-slate-500 uppercase tracking-wide">Estimated</span>
                <div className="mt-1 text-slate-700">{(entity as Issue).estimatedHours}h</div>
              </div>
            )}
            {entityType === 'issue' && (entity as Issue).actualHours && (
              <div>
                <span className="text-slate-500 uppercase tracking-wide">Actual</span>
                <div className="mt-1 text-slate-700">{(entity as Issue).actualHours}h</div>
              </div>
            )}
            {isProject && (entity as Project).directory && (
              <div className="col-span-2">
                <span className="text-slate-500 uppercase tracking-wide">Directory</span>
                <div className="mt-1 font-mono text-slate-700 text-xs">{(entity as Project).directory}</div>
              </div>
            )}
            <div>
              <span className="text-slate-500 uppercase tracking-wide">Created</span>
              <div className="mt-1 text-slate-700">{new Date(entity.createdAt).toLocaleDateString()}</div>
            </div>
            <div>
              <span className="text-slate-500 uppercase tracking-wide">Updated</span>
              <div className="mt-1 text-slate-700">{new Date(entity.updatedAt).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Comments section for epics and issues */}
          {(entityType === 'epic' || entityType === 'issue') && (
            <div className="border-t border-gray-100 pt-4">
              <CommentPanel entityType={entityType} entityId={entityId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
