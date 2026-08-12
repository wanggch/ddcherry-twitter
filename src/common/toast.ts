/**
 * In-page toast notification utilities.
 * This function is designed to be injected via chrome.scripting.executeScript,
 * so it must be self-contained and not rely on any external imports.
 */

export type ToastType = 'success' | 'error';

const TOAST_CONTAINER_ID = 'x-post-saver-toast-container';
const TOAST_ID = 'x-post-saver-toast';

/**
 * Creates and shows a toast notification inside the current page.
 * Injected directly into the page context.
 */
export function showToastInPage(title: string, message: string, type: ToastType): void {
  const duration = type === 'success' ? 3000 : 0;
  const isError = type === 'error';

  // Remove existing toast if any
  const existing = document.getElementById(TOAST_ID);
  if (existing) {
    existing.remove();
  }

  // Container (fixed position, top-right)
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;
    document.body.appendChild(container);
  }

  // Toast card
  const toast = document.createElement('div');
  toast.id = TOAST_ID;
  const borderColor = isError ? '#EF4444' : '#10B981';
  const iconColor = borderColor;
  const iconSvg = isError
    ? '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/><path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    : '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" stroke="currentColor" stroke-width="2"/><path d="M6 10l3 3 5-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  toast.style.cssText = `
    pointer-events: auto;
    min-width: 240px;
    max-width: 360px;
    background: #ffffff;
    color: #111827;
    border-radius: 8px;
    border-left: 4px solid ${borderColor};
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    padding: 14px 16px;
    animation: x-post-saver-toast-in 0.25s ease-out;
    transition: opacity 0.3s ease, transform 0.3s ease;
  `;

  // Inner HTML
  toast.innerHTML = `
    <div style="display: flex; align-items: flex-start; gap: 12px;">
      <div style="flex-shrink: 0; color: ${iconColor}; margin-top: 1px;">
        ${iconSvg}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <strong style="font-size: 14px; line-height: 1.4;">${escapeHtml(title)}</strong>
          <button id="${TOAST_ID}-close" style="
            background: transparent;
            border: none;
            cursor: pointer;
            padding: 2px;
            margin: -2px;
            color: #9CA3AF;
            line-height: 1;
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
          " aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
        <div style="margin-top: 4px; font-size: 13px; line-height: 1.5; color: #4B5563; word-break: break-word;">${escapeHtml(message)}</div>
      </div>
    </div>
  `;

  // Inject keyframe animation once
  if (!document.getElementById('x-post-saver-toast-style')) {
    const style = document.createElement('style');
    style.id = 'x-post-saver-toast-style';
    style.textContent = `
      @keyframes x-post-saver-toast-in {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
    `;
    document.head.appendChild(style);
  }

  container.appendChild(toast);

  const closeButton = document.getElementById(`${TOAST_ID}-close`) as HTMLButtonElement | null;

  function removeToast(): void {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => {
      toast.remove();
      if (container && container.childElementCount === 0) {
        container.remove();
      }
    }, 300);
  }

  if (closeButton) {
    closeButton.addEventListener('click', removeToast);
    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.backgroundColor = '#F3F4F6';
      closeButton.style.color = '#6B7280';
    });
    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.backgroundColor = 'transparent';
      closeButton.style.color = '#9CA3AF';
    });
  }

  if (duration > 0) {
    setTimeout(removeToast, duration);
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
