import React from 'react';
import { cn } from '../../lib/utils';
import { BottomNav } from './BottomNav';
import { PageHeader } from '../PageHeader';

interface PageContainerProps {
  children: React.ReactNode;
  title: string;
  titleClassName?: string;
  homeHeader?: boolean;
  className?: string;
  actions?: React.ReactNode;
  devMode?: boolean;
}

export function PageContainer({ children, title, titleClassName, homeHeader, className, actions, devMode }: PageContainerProps) {
  return (
    <div className="app-shell bg-background text-foreground">
      {devMode !== undefined ? <PageHeader title={title} devMode={devMode} className="app-content ui-page-header--page" /> : <header className={homeHeader ? 'app-content app-home-header app-home-header--page' : 'app-content pt-12 pb-6 flex flex-wrap gap-3 justify-between items-end'}>
        <h1 className={titleClassName ?? 'text-4xl font-bold tracking-tight'}>{title}</h1>
        {actions && <div className="flex gap-2 ml-auto">{actions}</div>}
      </header>}
      <main className={cn("app-content", className)}>
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
