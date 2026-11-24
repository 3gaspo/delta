import { ArrowLeftRight, CalendarDays, Coins, Download, EyeOff, HandCoins, Home, Landmark, Layers3, PieChart, Plus, Repeat, Settings, Tags, TrendingUp } from 'lucide-react';
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
      { icon: Plus, text: 'Log income, costs or transfers', primary: true },
      { icon: Layers3, text: 'Split transactions in multiple accounts' },
      { icon: EyeOff, text: 'Mask entries from statistics' },
      { icon: Download, text: 'Import bank transactions' },
    ],
  },
  {
    icon: Landmark,
    title: 'Accounts',
    actions: [
      { icon: Plus, text: 'Add an account', primary: true },
      { icon: HandCoins, text: 'Debt (+ to you, − you owe)' },
      { icon: Repeat, text: 'Schedule bills or transfers' },
      { icon: CalendarDays, text: 'Preview a typical month' },
    ],
  },
  {
    icon: PieChart,
    title: 'Statistics',
    actions: [
      { icon: TrendingUp, text: 'Track account balances' },
      { icon: ArrowLeftRight, text: 'Compare income and costs' },
      { icon: PieChart, text: 'Check category budgets' },
    ],
  },
  {
    icon: Settings,
    title: 'Settings',
    actions: [
      { icon: Tags, text: 'Manage categories and tags' },
      { icon: Coins, text: 'Choose a display currency' },
    ],
  },
] as const satisfies TutorialPages;
