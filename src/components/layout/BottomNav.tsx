import { NavLink } from 'react-router-dom';
import { Home, Landmark, PieChart, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

export function BottomNav() {
  const items = [
    { to: '/home', icon: Home, label: 'Home' },
    { to: '/accounts', icon: Landmark, label: 'Accounts' },
    { to: '/stats', icon: PieChart, label: 'Stats' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-black/80 backdrop-blur-lg border-t border-black/5 dark:border-white/5 pb-safe z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => cn(
              "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors",
              isActive ? "text-black dark:text-white" : "text-black/30 dark:text-white/30"
            )}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
