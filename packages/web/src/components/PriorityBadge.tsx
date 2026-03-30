const priorityColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-500',
};

const priorityIcons: Record<string, string> = {
  critical: '!!!',
  high: '!!',
  medium: '!',
  low: '-',
};

export function PriorityBadge({ priority }: { priority: string }) {
  const color = priorityColors[priority] || 'bg-gray-100 text-gray-500';
  const icon = priorityIcons[priority] || '-';
  return (
    <span className={`inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded-md ${color}`} title={priority}>
      {icon}
    </span>
  );
}
