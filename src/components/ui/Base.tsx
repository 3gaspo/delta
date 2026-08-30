import React, { useState, useRef, useEffect, useMemo } from 'react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence, HTMLMotionProps } from 'motion/react';
import { ChevronDown, Check } from 'lucide-react';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'size'> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  ghost?: boolean;
}

export function Button({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  ghost,
  children,
  ...props 
}: ButtonProps) {
  const effectiveVariant = ghost ? 'ghost' : (variant === 'danger' ? 'destructive' : variant);

  const variants: Record<string, string> = {
    primary: "bg-black text-white dark:bg-white dark:text-black",
    secondary: "bg-black/5 text-black dark:bg-white/5 dark:text-white",
    destructive: "bg-red-500 text-white hover:bg-red-600",
    danger: "bg-red-500 text-white hover:bg-red-600",
    ghost: "bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-foreground",
    outline: "bg-transparent border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-foreground"
  };

  const sizes: Record<string, string> = {
    sm: "px-4 py-2 text-sm rounded-xl",
    md: "px-6 py-3 font-medium rounded-2xl",
    lg: "px-8 py-4 text-lg font-bold rounded-3xl",
    icon: "p-3 rounded-2xl"
  };

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={cn(
        "inline-flex items-center justify-center transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        variants[effectiveVariant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
  label?: string;
  actions?: React.ReactNode;
}

export function Card({ children, className, label, actions }: CardProps) {
  return (
    <section className="bg-black/5 dark:bg-white/5 p-6 rounded-[32px] mb-6 last:mb-0">
      {(label || actions) && (
        <div className="flex items-center justify-between mb-4 px-2">
          {label ? (
            <span className="block text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">
              {label}
            </span>
          ) : <div />}
          {actions && (
            <div>{actions}</div>
          )}
        </div>
      )}
      <div className={cn("bg-white dark:bg-black/20 rounded-2xl shadow-sm", className)}>
        {children}
      </div>
    </section>
  );
}

export function Input({ className, icon: Icon, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { icon?: any }) {
  return (
    <div className="relative w-full">
      {Icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 text-foreground pointer-events-none">
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

interface ParsedOptionItem {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  icon?: any;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement> | { target: { value: string; name?: string } }) => void;
  options?: Array<{ value: string; label: React.ReactNode; disabled?: boolean }>;
}

export function Select({ 
  className, 
  icon: Icon, 
  children, 
  value, 
  defaultValue, 
  onChange, 
  disabled, 
  name, 
  required,
  placeholder,
  ...props 
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract options from props.options or from JSX children
  const parsedOptions = useMemo<ParsedOptionItem[]>(() => {
    if (props.options && props.options.length > 0) {
      return props.options.map(o => ({
        value: String(o.value),
        label: o.label,
        disabled: o.disabled
      }));
    }

    const items: ParsedOptionItem[] = [];
    const extract = (nodes: React.ReactNode) => {
      React.Children.forEach(nodes, (child) => {
        if (!React.isValidElement(child)) return;
        const childType = typeof child.type === 'string' 
          ? child.type.toLowerCase() 
          : (child.type as any)?.name?.toLowerCase();
        
        if (childType === 'option' || child.type === 'option' || (child.props as any)?.value !== undefined) {
          const optProps = child.props as any;
          items.push({
            value: optProps.value !== undefined ? String(optProps.value) : String(optProps.children || ''),
            label: optProps.children !== undefined ? optProps.children : String(optProps.value || ''),
            disabled: optProps.disabled
          });
        } else if (child.type === React.Fragment || (child.props as any)?.children) {
          extract((child.props as any).children);
        }
      });
    };

    extract(children);
    return items;
  }, [children, props.options]);

  // Current active value
  const currentValue = useMemo(() => {
    if (value !== undefined) return String(value);
    if (defaultValue !== undefined) return String(defaultValue);
    return parsedOptions[0]?.value || '';
  }, [value, defaultValue, parsedOptions]);

  // Selected option display label
  const selectedOption = useMemo(() => {
    return parsedOptions.find(o => o.value === currentValue) || parsedOptions[0];
  }, [parsedOptions, currentValue]);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (opt: ParsedOptionItem) => {
    if (opt.disabled) return;
    setIsOpen(false);

    if (onChange) {
      onChange({
        target: {
          value: opt.value,
          name: name
        }
      } as any);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", isOpen && "z-50")}>
      {/* Hidden standard input for form integration */}
      <input type="hidden" name={name} value={currentValue} required={required} />

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "w-full flex items-center justify-between text-left",
          "bg-black/5 dark:bg-white/10 hover:bg-black/[0.08] dark:hover:bg-white/[0.14] border border-black/5 dark:border-white/5",
          "rounded-2xl px-4 py-3.5 focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none",
          "text-foreground font-medium text-sm tracking-tight cursor-pointer",
          disabled && "opacity-40 cursor-not-allowed pointer-events-none",
          isOpen && "ring-2 ring-black/10 dark:ring-white/20",
          className
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
          {Icon && (
            <div className="opacity-40 text-foreground shrink-0">
              <Icon size={18} />
            </div>
          )}
          <span className="truncate block font-medium">
            {selectedOption ? selectedOption.label : (placeholder || 'Select...')}
          </span>
        </div>

        <div className="opacity-40 text-foreground shrink-0">
          <ChevronDown 
            size={16} 
            className={cn("transition-transform duration-200", isOpen && "rotate-180 opacity-80")} 
          />
        </div>
      </button>

      {/* Custom Dropdown Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            role="listbox"
            className={cn(
              "absolute left-0 right-0 top-full mt-2 z-[150]",
              "bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/10 dark:border-white/10 shadow-2xl",
              "rounded-2xl p-1.5 max-h-60 overflow-y-auto custom-scrollbar"
            )}
          >
            {parsedOptions.length === 0 ? (
              <div className="px-3 py-2 text-xs opacity-50 text-center font-medium">
                No options available
              </div>
            ) : (
              parsedOptions.map((opt, idx) => {
                const isSelected = opt.value === currentValue;
                return (
                  <button
                    key={`${opt.value}-${idx}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt)}
                    className={cn(
                      "w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between gap-2 cursor-pointer",
                      isSelected
                        ? "bg-black/5 dark:bg-white/10 text-foreground font-bold shadow-xs"
                        : "text-foreground/80 hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground",
                      opt.disabled && "opacity-35 cursor-not-allowed hover:bg-transparent pointer-events-none"
                    )}
                  >
                    <span className="truncate flex-1">{opt.label}</span>
                    {isSelected && (
                      <Check size={15} className="shrink-0 text-foreground opacity-90 stroke-[2.5]" />
                    )}
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
