import { ArrowLeftRight, CalendarDays, Coins, Download, EyeOff, HandCoins, Home, Landmark, Layers3, Moon, PieChart, Plus, Repeat, Search, Settings, Tags, TrendingUp } from 'lucide-react';
import type { TutorialPages } from '@3gaspo/app-ui/Tutorial';

export const tutorialPages = [
  {
    logo: '/delta.svg',
    title: 'Track your finances',
    description: 'Keep your accounts, spending and upcoming bills in one place.',
  },
  {
    icon: Home,
    title: 'Home',
    actions: [
      { icon: Plus, text: 'Record an expense, income or transfer', primary: true },
      { icon: Layers3, text: 'Group transactions split one bill and track who owes whom' },
      { icon: EyeOff, text: 'Hidden expenses stay in history and are left out of balances and statistics' },
      { icon: Search, text: 'Search and filter transactions' },
      { icon: Download, text: 'Import bank transactions' },
    ],
  },
  {
    icon: Landmark,
    title: 'Accounts',
    actions: [
      { icon: Plus, text: 'Add accounts and track balances', primary: true },
      { icon: HandCoins, text: 'Debt accounts track money owed to you (+) or by you (−)' },
      { icon: Repeat, text: 'Set up recurring bills and transfers' },
      { icon: CalendarDays, text: 'Preview a typical month' },
    ],
  },
  {
    icon: PieChart,
    title: 'Statistics',
    actions: [
      { icon: TrendingUp, text: 'Follow account balances over time' },
      { icon: ArrowLeftRight, text: 'Compare income and spending' },
      { icon: PieChart, text: 'Check your category budgets' },
    ],
  },
  {
    icon: Settings,
    title: 'Settings',
    actions: [
      { icon: Tags, text: 'Manage categories and tags' },
      { icon: Coins, text: 'Choose a display currency' },
      { icon: Moon, text: 'Switch between light and dark' },
    ],
  },
] as const satisfies TutorialPages;
