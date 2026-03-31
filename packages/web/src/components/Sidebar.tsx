import { useState } from 'react';
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
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav className={`bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all duration-200 ${collapsed ? 'w-14' : 'w-52'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200">
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-base font-bold text-teal-600 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>Ravenclaw</h1>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 text-slate-400 hover:text-slate-600 hover:bg-gray-100 rounded transition-colors shrink-0"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-4'} py-2.5 text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-teal-50 text-teal-700 border-l-2 border-teal-500'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-gray-50 border-l-2 border-transparent'
              }`
            }
          >
            <span className="text-base shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
