import { useEffect, useId, useRef, useState } from 'react';
import { useDialogOwner } from '../Dialog';
import { createPortal } from 'react-dom';
import { Check, Palette } from 'lucide-react';

export const PRESET_CATEGORY_COLORS = [
  '#64748b', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e', '#18181b',
];

interface CategoryColorPickerProps {
  color?: string;
  onChange: (color: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function CategoryColorPicker({
  color = '#64748b', onChange, className, size = 'md', label = 'Category color',
}: CategoryColorPickerProps) {
  const dialogOwner = useDialogOwner();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ left: 16, top: 16, width: 256, maxHeight: 320 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const width = Math.min(256, window.innerWidth - 32);
      const height = popoverRef.current?.offsetHeight || 252;
      const below = window.innerHeight - trigger.bottom - 24;
      const above = trigger.top - 24;
      const openAbove = below < height && above > below;
      const maxHeight = Math.max(80, openAbove ? above : below);
      setPosition({
        left: Math.max(16, Math.min(trigger.right - width, window.innerWidth - width - 16)),
        top: openAbove ? Math.max(16, trigger.top - Math.min(height, maxHeight) - 8) : trigger.bottom + 8,
        width, maxHeight,
      });
    };
    const handleOutsideClick = (event: PointerEvent) => {
      if (!triggerRef.current?.contains(event.target as Node) && !popoverRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };
    updatePosition();
    popoverRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus({ preventScroll: true });
    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen]);

  const sizeClass = { sm: 'w-8 h-8 rounded-xl', md: 'w-12 h-12 rounded-2xl', lg: 'w-14 h-14 rounded-2xl' }[size];

  return (
    <div className={['inline-block shrink-0', className].filter(Boolean).join(' ')}>
      <button ref={triggerRef} type="button" onClick={() => setIsOpen(open => !open)}
        aria-label={label} aria-expanded={isOpen} aria-controls={isOpen ? popoverId : undefined}
        title="Change category color"
        className={`${sizeClass} relative flex items-center justify-center overflow-hidden border border-ui-ink/10 shadow-inner cursor-pointer group transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2 focus-visible:ring-offset-ui-page`}
        style={{ backgroundColor: color }}
      >
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
          <Palette size={size === 'sm' ? 12 : 16} className="text-white opacity-0 group-hover:opacity-100 drop-shadow" />
        </span>
      </button>
      {isOpen && createPortal(
        <div ref={popoverRef} id={popoverId} role="group" aria-label={label} data-dialog-owner={dialogOwner}
          className="fixed z-[200] rounded-2xl border border-ui-ink/10 bg-ui-overlay p-3 text-ui-text shadow-2xl overflow-y-auto" style={position}
        >
          <div className="flex items-center justify-between gap-2 border-b border-ui-border pb-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">{label}</span>
            <span className="rounded-md bg-ui-section px-2 py-0.5 font-mono text-[10px] font-bold uppercase">{color}</span>
          </div>
          <div className="grid grid-cols-6 gap-2 mb-3">
            {PRESET_CATEGORY_COLORS.map(preset => {
              const selected = color.toLowerCase() === preset;
              return <button key={preset} type="button" aria-label={`Use color ${preset}`} aria-pressed={selected}
                onClick={() => { onChange(preset); setIsOpen(false); triggerRef.current?.focus(); }} title={preset}
                className={`w-7 h-7 rounded-xl border border-black/10 shadow-sm flex items-center justify-center cursor-pointer transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink focus-visible:ring-offset-2 focus-visible:ring-offset-ui-overlay ${selected ? 'ring-2 ring-ui-ink scale-105' : ''}`}
                style={{ backgroundColor: preset }}
              >{selected && <Check size={12} className="text-white drop-shadow" />}</button>;
            })}
          </div>
          <div className="border-t border-ui-border pt-2">
            <button type="button" onClick={() => colorInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-ui-section px-3 py-2 text-xs font-bold cursor-pointer hover:bg-ui-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ui-ink"
            >
              <Palette size={14} /><span>Custom Color</span>
              <span className="ml-auto w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: color }} />
            </button>
            <input ref={colorInputRef} type="color" aria-label={`Custom ${label.toLowerCase()}`}
              value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#64748b'}
              onChange={event => onChange(event.target.value)} className="sr-only"
            />
          </div>
        </div>, document.body,
      )}
    </div>
  );
}
