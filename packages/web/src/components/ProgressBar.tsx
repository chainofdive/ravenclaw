export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  const clampedValue = Math.min(100, Math.max(0, value));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden flex-1">
        <div
          className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full transition-all duration-300"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
