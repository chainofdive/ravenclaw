const statusColors: Record<string, string> = {
  done: 'bg-emerald-100 text-emerald-700',
  active: 'bg-sky-100 text-sky-700',
  in_progress: 'bg-sky-100 text-sky-700',
  todo: 'bg-amber-100 text-amber-700',
  backlog: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
  in_review: 'bg-violet-100 text-violet-700',
};

export function StatusBadge({ status }: { status: string }) {
  const color = statusColors[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${color}`}>
      {status.replace('_', ' ')}
    </span>
  );
}
