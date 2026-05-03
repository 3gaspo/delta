import React from 'react';
import { cn } from '../../lib/utils';
import { BottomNav } from './BottomNav';

interface PageContainerProps {
  children: React.ReactNode;
  title: string;
  className?: string;
  actions?: React.ReactNode;
}

export function PageContainer({ children, title, className, actions }: PageContainerProps) {
  return (
    <div className="min-h-screen bg-background text-foreground pb-32">
      <header className="px-6 pt-12 pb-6 max-w-lg mx-auto flex justify-between items-end">
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        {actions && <div className="flex gap-2">{actions}</div>}
      </header>
      <main className={cn("px-6 max-w-lg mx-auto", className)}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
