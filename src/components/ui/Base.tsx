import React from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export function Button({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  children,
  ...props 
}: any) {
  const variants = {
    primary: "bg-black text-white dark:bg-white dark:text-black",
    secondary: "bg-black/5 text-black dark:bg-white/5 dark:text-white",
    destructive: "bg-red-500 text-white",
    ghost: "bg-transparent hover:bg-black/5 dark:hover:bg-white/5"
  };

  const sizes = {
    sm: "px-4 py-2 text-sm rounded-xl",
    md: "px-6 py-3 font-medium rounded-2xl",
    lg: "px-8 py-4 text-lg font-bold rounded-3xl",
    icon: "p-3 rounded-2xl"
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={cn(
        "inline-flex items-center justify-center transition-colors disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className
      )}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
  label?: string;
}

export function Card({ children, className, label }: CardProps) {
  return (
    <section className="bg-black/5 dark:bg-white/5 p-6 rounded-[32px] mb-6 last:mb-0">
      {label && (
        <span className="block text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 mb-4 px-2">
          {label}
        </span>
      )}
      <div className={cn("bg-white dark:bg-black/20 rounded-2xl overflow-hidden shadow-sm", className)}>
        {children}
      </div>
    </section>
  );
}

export function Input({ className, icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: any }) {
  return (
    <div className="relative w-full">
      {Icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-foreground">
          <Icon size={18} />
        </div>
      )}
      <input
        className={cn(
          "w-full bg-black/5 dark:bg-white/10 border-0 rounded-2xl px-4 py-4 focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none text-foreground placeholder:text-foreground/30",
          Icon && "pl-12",
          className
        )}
        {...props}
      />
    </div>
  );
}

export function Select({ className, icon: Icon, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { icon?: any }) {
  return (
    <div className="relative w-full">
      {Icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-foreground">
          <Icon size={18} />
        </div>
      )}
      <select
        className={cn(
          "w-full appearance-none bg-black/5 dark:bg-white/10 border-0 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none pr-10 text-foreground bg-background truncate",
          Icon && "pl-12",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-30 text-foreground">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4.5L6 7.5L9 4.5" />
        </svg>
      </div>
    </div>
  );
}
