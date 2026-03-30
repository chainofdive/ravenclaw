import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  title,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <div className={`bg-white rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06)] border border-gray-100 p-4 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${className}`}>
      {title && <h3 className="text-sm font-semibold text-slate-700 mb-3">{title}</h3>}
      {children}
    </div>
  );
}
