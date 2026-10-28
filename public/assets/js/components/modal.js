export class Modal {
  static open(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Trap focus and ESC close
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        Modal.close(modalId);
        window.removeEventListener('keydown', handleKey);
      }
    };
    window.addEventListener('keydown', handleKey);
  }

  static close(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  static setupDismissListeners() {
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.remove('active');
          document.body.style.overflow = '';
        }
      });

      const closeButtons = backdrop.querySelectorAll('[data-dismiss="modal"]');
      closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          backdrop.classList.remove('active');
          document.body.style.overflow = '';
        });
      });
    });
  }
}

