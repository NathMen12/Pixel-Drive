/**
 * DOM Utilities - Toast, Modal, Formatting, Helpers
 */

// Toast notifications
const toastContainer = (() => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }
  return container;
})();

export function showToast(message, type = 'info', duration = 4000) {
  const colors = {
    success: { bg: '#064e3b', border: '#10b981', icon: '✓' },
    error: { bg: '#7f1d1d', border: '#ef4444', icon: '✕' },
    warning: { bg: '#78350f', border: '#f59e0b', icon: '⚠' },
    info: { bg: '#1e3a5f', border: '#3b82f6', icon: 'ℹ' },
  };

  const { bg, border, icon } = colors[type] || colors.info;

  const toast = document.createElement('div');
  toast.style.cssText = `
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    background: ${bg};
    border: 1px solid ${border};
    border-radius: 10px;
    color: white;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease-out;
    max-width: 360px;
  `;
  toast.innerHTML = `
    <span style="flex-shrink: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: ${border}; border-radius: 50%; font-size: 12px; font-weight: bold;">${icon}</span>
    <span style="flex: 1;">${escapeHtml(message)}</span>
    <button style="flex-shrink: 0; background: none; border: none; color: #9ca3af; cursor: pointer; padding: 4px; font-size: 16px; line-height: 1;">×</button>
  `;

  toast.querySelector('button').addEventListener('click', () => removeToast(toast));
  toastContainer.appendChild(toast);

  // Auto remove
  setTimeout(() => removeToast(toast), duration);

  return toast;
}

function removeToast(toast) {
  toast.style.animation = 'slideOut 0.2s ease-in forwards';
  setTimeout(() => toast.remove(), 200);
}

// Add toast animations
if (!document.getElementById('toast-styles')) {
  const style = document.createElement('style');
  style.id = 'toast-styles';
  style.textContent = `
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(100px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideOut {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(100px); }
    }
  `;
  document.head.appendChild(style);
}

// Modal system
let modalStack = [];

export function showModal({ title, content, size = 'md', actions = [] }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      animation: fadeIn 0.2s ease-out;
    `;

    const sizes = {
      sm: 'max-width: 400px;',
      md: 'max-width: 560px;',
      lg: 'max-width: 720px;',
      xl: 'max-width: 960px;',
      full: 'max-width: 95vw; max-height: 95vh;',
    };

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
      width: 100%;
      ${sizes[size] || sizes.md}
      background: #111827;
      border: 1px solid #1f2937;
      border-radius: 16px;
      box-shadow: 0 25px 50px rgba(0,0,0,0.5);
      animation: slideUp 0.3s ease-out;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    let actionsHtml = '';
    if (actions.length > 0) {
      actionsHtml = `
        <div style="display: flex; gap: 8px; justify-content: flex-end; padding: 16px 24px; border-top: 1px solid #1f2937; flex-wrap: wrap;">
          ${actions.map((action, i) => `
            <button data-value="${escapeHtml(action.value ?? action.label)}" class="modal-action-btn" style="
              padding: 10px 20px;
              border-radius: 8px;
              font-size: 13px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.15s;
              ${action.variant === 'primary' ? 'background: #4f46e5; color: white; border: none;' : ''}
              ${action.variant === 'secondary' ? 'background: #374151; color: white; border: 1px solid #4b5563;' : ''}
              ${action.variant === 'ghost' ? 'background: transparent; color: #9ca3af; border: 1px solid transparent;' : ''}
              ${action.variant === 'danger' ? 'background: #dc2626; color: white; border: none;' : ''}
            ">${escapeHtml(action.label)}</button>
          `).join('')}
        </div>
      `;
    }

    modal.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 20px 24px; border-bottom: 1px solid #1f2937;">
        <h2 style="font-size: 18px; font-weight: 600;">${escapeHtml(title)}</h2>
        <button class="modal-close" style="width: 36px; height: 36px; border-radius: 8px; background: #1f2937; border: 1px solid #374151; color: #9ca3af; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; line-height: 1;">×</button>
      </div>
      <div style="flex: 1; overflow: auto; padding: 24px;">${content}</div>
      ${actionsHtml}
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    // Focus trap
    const focusableElements = modal.querySelectorAll('button, input, select, textarea, a[href]');
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    firstFocusable?.focus();

    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        closeModal(null);
      } else if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        } else if (!e.shiftKey && document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeydown);

    function closeModal(value) {
      document.removeEventListener('keydown', handleKeydown);
      overlay.style.animation = 'fadeOut 0.2s ease-in forwards';
      modal.style.animation = 'slideDown 0.2s ease-in forwards';
      setTimeout(() => {
        overlay.remove();
        document.body.style.overflow = '';
        resolve(value);
      }, 200);
    }

    // Close button
    modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal('cancel'));

    // Action buttons
    modal.querySelectorAll('.modal-action-btn').forEach(btn => {
      btn.addEventListener('click', () => closeModal(btn.dataset.value));
    });

    // Click overlay to close (if no actions or last action is cancel)
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal('cancel');
    });

    modalStack.push({ overlay, closeModal: closeModal });
  });
}

export function closeModal(value = 'cancel') {
  const modal = modalStack.pop();
  if (modal) {
    modal.closeModal(value);
  }
}

// Add modal animations
if (!document.getElementById('modal-styles')) {
  const style = document.createElement('style');
  style.id = 'modal-styles';
  style.textContent = `
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideDown { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(20px); } }
  `;
  document.head.appendChild(style);
}

// Format utilities
export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'Ko', 'Mo', 'Go', 'To', 'Po'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(date, options = {}) {
  if (!date) return '—';
  const d = new Date(date);
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function formatRelativeTime(date) {
  if (!date) return '—';
  const now = new Date();
  const then = new Date(date);
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `il y a ${years} an${years > 1 ? 's' : ''}`;
  if (months > 0) return `il y a ${months} mois`;
  if (days > 0) return `il y a ${days} jour${days > 1 ? 's' : ''}`;
  if (hours > 0) return `il y a ${hours}h`;
  if (minutes > 0) return `il y a ${minutes}min`;
  return 'à l\'instant';
}

export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function getFileIconSvg(mimeType, size = 24) {
  if (!mimeType) {
    return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #6b7280;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>`;
  }
  if (mimeType.startsWith('image/')) {
    return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #6366f1;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;
  }
  if (mimeType.startsWith('video/')) {
    return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #8b5cf6;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>`;
  }
  if (mimeType.startsWith('audio/')) {
    return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #f59e0b;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1a1 1 0 011 1v3.586a1 1 0 01-.293.707l-5.586 5.586a1 1 0 01-1.414 0z"></path></svg>`;
  }
  if (mimeType === 'application/pdf') {
    return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #ef4444;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>`;
  }
  if (mimeType.includes('zip') || mimeType.includes('compressed') || mimeType.includes('archive')) {
    return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #f59e0b;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>`;
  }
  if (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType.includes('javascript') || mimeType.includes('typescript')) {
    return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #10b981;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`;
  }
  return `<svg width="${size}" height="${size}" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #6b7280;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>`;
}

// Debounce utility
export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Throttle utility
export function throttle(fn, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Generate unique ID
export function generateId() {
  return crypto.randomUUID();
}

// Copy to clipboard
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    return true;
  }
}

// Parse query string
export function parseQueryString(query) {
  const params = new URLSearchParams(query);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
}

// Build query string
export function buildQueryString(params) {
  return new URLSearchParams(params).toString();
}