import { Home, Landmark, PieChart, Settings } from 'lucide-react';
import { BottomNavigation } from '../BottomNavigation';

const items = [
  { to: '/home', icon: Home, label: 'Home' },
  { to: '/accounts', icon: Landmark, label: 'Accounts' },
  { to: '/stats', icon: PieChart, label: 'Statistics' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export function BottomNav() { return <BottomNavigation items={items} />; }
