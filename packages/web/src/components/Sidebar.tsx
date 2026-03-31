import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '◫' },
  { to: '/projects', label: 'Projects', icon: '▣' },
  { to: '/issues', label: 'Issues', icon: '◇' },
  { to: '/agents', label: 'Agents', icon: '⚙' },
  { to: '/wiki', label: 'Wiki', icon: '▤' },
  { to: '/ontology', label: 'Ontology', icon: '◎' },
  { to: '/context', label: 'Context', icon: '⧉' },
];

export function Sidebar() {
  return (
    <nav className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-bold text-teal-600 tracking-tight font-[var(--font-display)]" style={{ fontFamily: 'var(--font-display)' }}>Ravenclaw</h1>
        <p className="text-xs text-slate-400 mt-0.5">Work Context Manager</p>
      </div>
      <div className="flex-1 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-teal-50 text-teal-700 border-l-2 border-teal-500'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50 border-l-2 border-transparent'
              }`
            }
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
