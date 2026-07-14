/**
 * Rename Modal Component
 * Rename file/folder dialog
 */

import { showModal } from '../utils/dom.js';

export class RenameModal {
  static async show(node) {
    if (!node) return false;

    const result = await showModal({
      title: `Renommer : ${node.name}`,
      size: 'sm',
      content: `
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <div>
            <label style="display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px;">Nouveau nom</label>
            <input type="text" id="rename-input" class="form-input" value="${node.name}" style="padding: 12px 14px; background: #1f2937; border: 1px solid #374151; border-radius: 10px; color: white; font-size: 14px; width: 100%; box-sizing: border-box;">
          </div>
        </div>
      `,
      actions: [
        { label: 'Annuler', variant: 'ghost', value: 'cancel' },
        { label: 'Renommer', variant: 'primary', value: 'rename' },
      ],
    });

    if (result === 'rename') {
      const newName = document.querySelector('#rename-input')?.value?.trim();
      if (newName && newName !== node.name) {
        return newName;
      }
    }

    return null;
  }
}

// Backward compatibility export
export async function showRenameModal(node) {
  return RenameModal.show(node);
}
