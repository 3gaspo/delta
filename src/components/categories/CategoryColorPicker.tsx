import React, { useState, useRef, useEffect } from 'react';
import { Check, Palette } from 'lucide-react';
import { cn } from '../../lib/utils';

export const PRESET_CATEGORY_COLORS = [
  '#64748b', // Slate
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#0ea5e9', // Sky
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#18181b', // Dark Charcoal
];

interface CategoryColorPickerProps {
  color?: string;
  onChange: (newColor: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CategoryColorPicker({
  color = '#64748b',
  onChange,
  className,
  size = 'md'
}: CategoryColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-xl',
    md: 'w-12 h-12 rounded-2xl',
    lg: 'w-14 h-14 rounded-2xl'
  };

  const normalizedColor = color.toLowerCase();

  return (
    <div className={cn("relative inline-block", className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          sizeClasses[size],
          "shadow-inner border border-black/10 dark:border-white/10 flex-shrink-0 cursor-pointer transition-all duration-200 group relative flex items-center justify-center hover:scale-105 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20"
        )}
        style={{ backgroundColor: color }}
        title="Change category color"
      >
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-inherit transition-colors flex items-center justify-center">
          <Palette size={size === 'sm' ? 12 : 16} className="text-white opacity-0 group-hover:opacity-100 drop-shadow transition-opacity" />
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 p-3 bg-card border border-black/10 dark:border-white/10 rounded-2xl shadow-2xl w-64 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-black/5 dark:border-white/5">
            <span className="text-[10px] font-black uppercase tracking-wider opacity-60">
              Category Color
            </span>
            <span className="text-[10px] font-mono font-bold uppercase opacity-80 bg-black/5 dark:bg-white/5 px-2 py-0.5 rounded-md">
              {color}
            </span>
          </div>

          {/* Palette presets */}
          <div className="grid grid-cols-6 gap-2 mb-3">
            {PRESET_CATEGORY_COLORS.map(preset => {
              const isSelected = normalizedColor === preset.toLowerCase();
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    onChange(preset);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-7 h-7 rounded-xl transition-transform hover:scale-110 flex items-center justify-center border border-black/10 dark:border-white/10 shadow-sm",
                    isSelected ? "ring-2 ring-black dark:ring-white scale-105" : ""
                  )}
                  style={{ backgroundColor: preset }}
                  title={preset}
                >
                  {isSelected && (
                    <Check size={12} className="text-white drop-shadow" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom color picker option */}
          <div className="pt-2 border-t border-black/5 dark:border-white/5">
            <button
              type="button"
              onClick={() => colorInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Palette size={14} />
              <span>Custom Color</span>
              <div 
                className="w-4 h-4 rounded-full border border-black/10 dark:border-white/10 ml-auto shadow-sm"
                style={{ backgroundColor: color }}
              />
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={color.startsWith('#') ? color : '#64748b'}
              onChange={e => onChange(e.target.value)}
              className="sr-only"
            />
          </div>
        </div>
      )}
    </div>
  );
}
