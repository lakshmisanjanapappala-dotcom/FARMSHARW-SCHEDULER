export class Toast {
  static init() {
    if (!document.querySelector('.toast-container')) {
      const container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
  }

  static show(message, type = 'info', durationMs = 4000) {
    this.init();
    const container = document.querySelector('.toast-container');

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 8px;">
        <div style="font-weight: 500; font-size: 0.9rem;">${message}</div>
        <button style="background:none; border:none; cursor:pointer; font-size:1.1rem; line-height:1; color:#888;">&times;</button>
      </div>
    `;

    const closeBtn = toast.querySelector('button');
    closeBtn.onclick = () => toast.remove();

    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, durationMs);
  }

  static success(msg) { this.show(msg, 'success'); }
  static error(msg) { this.show(msg, 'error'); }
  static warning(msg) { this.show(msg, 'warning'); }
}

