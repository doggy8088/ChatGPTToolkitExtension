import { getMessage } from '../utils/i18n';
import { createIcon } from './icons';

export type StatusType = 'success' | 'error';

export interface ConfirmOptions {
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive. */
  danger?: boolean;
}

const TOAST_LIMIT = 3;
const TOAST_DURATION_MS: Record<StatusType, number> = { success: 2800, error: 5000 };
const TOAST_EXIT_MS = 250;

/**
 * Close a dialog when its backdrop is clicked. The dialog element has no padding, so a click whose
 * target is the dialog itself landed on the backdrop. Requiring the press to start there too avoids
 * closing when a text selection drag ends outside the card.
 */
export function onDialogBackdropClick(dialog: HTMLDialogElement, handler: () => void): void {
  let pressedOnBackdrop = false;
  dialog.addEventListener('pointerdown', (event) => {
    pressedOnBackdrop = event.target === dialog;
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog && pressedOnBackdrop) handler();
    pressedOnBackdrop = false;
  });
}

/**
 * Toast notifications and the confirmation dialog.
 */
export class OptionsUIController {
  private readonly toastRegion: HTMLElement;
  private readonly confirmDialog: HTMLDialogElement | null;
  private readonly confirmMessage: HTMLElement | null;
  private readonly confirmOkBtn: HTMLButtonElement | null;
  private readonly confirmCancelBtn: HTMLButtonElement | null;
  private settleConfirm: ((confirmed: boolean) => void) | null = null;

  constructor(toastRegionId: string, confirmDialogId: string) {
    this.toastRegion = document.getElementById(toastRegionId)!;
    this.confirmDialog = document.getElementById(confirmDialogId) as HTMLDialogElement | null;
    this.confirmMessage = document.getElementById(`${confirmDialogId}Message`);
    this.confirmOkBtn = document.getElementById(`${confirmDialogId}OkBtn`) as HTMLButtonElement | null;
    this.confirmCancelBtn = document.getElementById(`${confirmDialogId}CancelBtn`) as HTMLButtonElement | null;

    this.bindConfirmDialog();

    // Toasts shown inside a dialog move back to the page when it closes.
    document.querySelectorAll('dialog').forEach((dialog) => {
      dialog.addEventListener('close', () => this.relocateToasts());
    });
  }

  /**
   * Show a toast. Errors stay longer and are announced assertively.
   */
  showStatus(message: string, type: StatusType = 'success'): void {
    this.relocateToasts();

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

    const text = document.createElement('span');
    text.className = 'toast__text';
    text.textContent = message;
    toast.append(createIcon(type === 'error' ? 'alert-circle' : 'check-circle', 'icon toast__icon'), text);

    this.toastRegion.appendChild(toast);
    while (this.toastRegion.children.length > TOAST_LIMIT) {
      this.toastRegion.firstElementChild?.remove();
    }

    window.requestAnimationFrame(() => toast.classList.add('is-visible'));
    window.setTimeout(() => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => toast.remove(), TOAST_EXIT_MS);
    }, TOAST_DURATION_MS[type]);
  }

  /**
   * Modal dialogs render in the top layer and make the rest of the page inert, so the toast region
   * has to live inside the top-most open dialog to stay visible and announced.
   */
  relocateToasts(): void {
    const openDialogs = Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]'));
    const host = openDialogs[openDialogs.length - 1] ?? document.body;
    if (this.toastRegion.parentElement !== host) {
      host.appendChild(this.toastRegion);
    }
  }

  /**
   * Ask for confirmation with the page's dialog (falls back to `window.confirm`).
   */
  confirm(options: ConfirmOptions): Promise<boolean> {
    const dialog = this.confirmDialog;
    if (!dialog || !this.confirmMessage || !this.confirmOkBtn || !this.confirmCancelBtn || typeof dialog.showModal !== 'function') {
      return Promise.resolve(window.confirm(options.message));
    }

    // A newer request supersedes one that is still pending.
    this.settleConfirm?.(false);

    this.confirmMessage.textContent = options.message;
    this.confirmOkBtn.textContent = options.confirmLabel;
    this.confirmOkBtn.className = `btn ${options.danger ? 'btn--danger' : 'btn--primary'}`;
    this.confirmCancelBtn.textContent = options.cancelLabel ?? getMessage('options_modal_cancel_button');
    dialog.classList.toggle('is-danger', Boolean(options.danger));
    dialog.returnValue = '';

    return new Promise<boolean>((resolve) => {
      this.settleConfirm = (confirmed) => {
        this.settleConfirm = null;
        resolve(confirmed);
      };
      if (!dialog.open) dialog.showModal();
      this.relocateToasts();
      // Default to the safe choice.
      this.confirmCancelBtn?.focus();
    });
  }

  private bindConfirmDialog(): void {
    const dialog = this.confirmDialog;
    if (!dialog) return;

    this.confirmOkBtn?.addEventListener('click', () => dialog.close('confirm'));
    this.confirmCancelBtn?.addEventListener('click', () => dialog.close('cancel'));
    onDialogBackdropClick(dialog, () => dialog.close('cancel'));
    dialog.addEventListener('close', () => {
      this.settleConfirm?.(dialog.returnValue === 'confirm');
    });
  }
}
