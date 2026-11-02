import type { ReactNode } from 'react';
import { Dialog } from '../Dialog';

interface ModalProps { isOpen: boolean; onClose: () => void; title: string; children: ReactNode; busy?: boolean }

export function Modal({ isOpen, onClose, title, children, busy }: ModalProps) {
  return <Dialog open={isOpen} onClose={onClose} title={title} busy={busy}>{children}</Dialog>;
}
