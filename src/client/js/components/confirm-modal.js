/**
 * Confirm Modal Component
 * Simple confirmation dialog
 */

import { showModal } from '../utils/dom.js';

export async function confirm({ title, message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', variant = 'primary' }) {
  const result = await showModal({
    title,
    size: 'sm',
    content: `
      <div style="color: #d1d5db; line-height: 1.6;">${message}</div>
    `,
    actions: [
      { label: cancelLabel, variant: 'ghost', value: 'cancel' },
      { label: confirmLabel, variant, value: 'confirm' },
    ],
  });

  return result === 'confirm';
}