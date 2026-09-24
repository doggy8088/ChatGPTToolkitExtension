import type { CustomPrompt } from '../models/CustomPrompt';
import { getMessage } from '../utils/i18n';
import { renderPromptIcon } from '../utils/promptIcon';
import {
  ARGS_PLACEHOLDER,
  getPromptPreviewSegments,
  isPromptAutoPaste,
  isPromptAutoSubmit,
  isPromptEnabled,
} from '../utils/promptList';
import { createIcon, type IconName } from './icons';

export interface PromptCardOptions {
  prompt: CustomPrompt;
  /** Index in the full stored array. */
  index: number;
  /** Position within its group (independent of the search filter). */
  position: number;
  groupSize: number;
  /** Reordering is disabled while the list is filtered. */
  reorderEnabled: boolean;
  expanded: boolean;
  transitionName?: string;
}

export interface PromptCardCallbacks {
  onEdit: (index: number) => void;
  onToggle: (index: number, enabled: boolean) => void;
  onMove: (index: number, direction: -1 | 1) => void;
  onDelete: (index: number) => void;
  onExpandedChange: (index: number, expanded: boolean) => void;
}

export interface EmptyStateOptions {
  message: string;
  actionLabel: string;
  actionIcon?: IconName;
  actionVariant?: 'primary' | 'secondary';
  onAction: () => void;
  art?: boolean;
}

/** Visually hidden element in options.html explaining why reordering is unavailable. */
const REORDER_HINT_ID = 'reorderDisabledHint';

const asText = (value: unknown): string => (typeof value === 'string' ? value : '');

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Builds the prompt cards and list placeholders with DOM APIs (user data is only ever set as text).
 */
export class PromptRenderer {
  createPromptCard(options: PromptCardOptions, callbacks: PromptCardCallbacks): HTMLLIElement {
    const { prompt, index } = options;
    const enabled = isPromptEnabled(prompt);
    const titleId = `prompt-${index}-title`;
    const textId = `prompt-${index}-text`;

    const card = element('li', 'prompt-card');
    card.dataset.index = String(index);
    card.classList.toggle('is-disabled', !enabled);
    if (options.transitionName) {
      card.style.setProperty('view-transition-name', options.transitionName);
    }

    // Icon tile
    const iconTile = element('div', 'prompt-card__icon');
    iconTile.setAttribute('aria-hidden', 'true');
    iconTile.append(renderPromptIcon(prompt.svgIcon));

    // Title + tooltip text
    const head = element('div', 'prompt-card__head');
    const title = element('h2', 'prompt-card__title');
    title.id = titleId;
    title.append(element('span', 'prompt-card__title-text', asText(prompt.title) || getMessage('options_prompt_title_fallback')));
    const disabledBadge = element('span', 'badge badge--muted', getMessage('options_badge_disabled'));
    disabledBadge.hidden = enabled;
    title.append(disabledBadge);
    head.append(title);

    const altText = asText(prompt.altText);
    if (altText) {
      head.append(element('p', 'prompt-card__alt', altText));
    }

    // Actions
    const actions = element('div', 'prompt-card__actions');

    const toggle = element('input', 'switch');
    toggle.type = 'checkbox';
    toggle.setAttribute('role', 'switch');
    toggle.checked = enabled;
    toggle.setAttribute('aria-label', getMessage('options_modal_enabled_label'));
    toggle.setAttribute('aria-describedby', titleId);
    toggle.dataset.action = 'toggle';
    toggle.addEventListener('change', () => {
      card.classList.toggle('is-disabled', !toggle.checked);
      disabledBadge.hidden = toggle.checked;
      callbacks.onToggle(index, toggle.checked);
    });

    const separator = element('span', 'prompt-card__sep');
    separator.setAttribute('aria-hidden', 'true');

    const moveUp = this.createMoveButton('up', options, titleId, () => callbacks.onMove(index, -1));
    const moveDown = this.createMoveButton('down', options, titleId, () => callbacks.onMove(index, 1));

    const edit = element('button', 'btn btn--secondary btn--sm');
    edit.type = 'button';
    edit.dataset.action = 'edit';
    edit.setAttribute('aria-describedby', titleId);
    edit.append(createIcon('pencil'), element('span', undefined, getMessage('options_action_edit')));
    edit.addEventListener('click', () => callbacks.onEdit(index));

    const remove = this.createIconButton('trash', getMessage('options_action_delete'), titleId, 'icon-btn--danger has-tooltip-end');
    remove.dataset.action = 'delete';
    remove.addEventListener('click', () => callbacks.onDelete(index));

    actions.append(toggle, separator, moveUp, moveDown, edit, remove);

    card.append(iconTile, head, actions, this.createComposer(prompt, index, textId, options.expanded, callbacks));
    return card;
  }

  /**
   * Show "Show more" only on previews that are actually clamped. Must run after the cards are laid out.
   */
  updateOverflowToggles(container: ParentNode): void {
    container.querySelectorAll<HTMLElement>('.composer').forEach((composer) => {
      const text = composer.querySelector<HTMLElement>('.composer__text');
      const toggle = composer.querySelector<HTMLButtonElement>('.composer__expand');
      if (!text || !toggle) return;
      if (composer.classList.contains('is-expanded')) {
        toggle.hidden = false;
        return;
      }
      toggle.hidden = text.scrollHeight <= text.clientHeight + 1;
    });
  }

  createEmptyState(options: EmptyStateOptions): HTMLElement {
    const wrapper = element('div', 'empty-state');

    if (options.art !== false) {
      // A blank miniature composer, echoing the card previews.
      const art = element('div', 'empty-state__art');
      art.setAttribute('aria-hidden', 'true');
      art.append(
        element('span', 'empty-state__line'),
        element('span', 'empty-state__line empty-state__line--short'),
        (() => {
          const send = element('span', 'send-state__button');
          send.append(createIcon('arrow-up'));
          return send;
        })()
      );
      wrapper.append(art);
    }

    wrapper.append(element('p', 'empty-state__text', options.message));

    const button = element('button', `btn ${options.actionVariant === 'secondary' ? 'btn--secondary' : 'btn--primary'}`);
    button.type = 'button';
    if (options.actionIcon) button.append(createIcon(options.actionIcon));
    button.append(element('span', undefined, options.actionLabel));
    button.addEventListener('click', options.onAction);
    wrapper.append(button);

    return wrapper;
  }

  private createComposer(
    prompt: CustomPrompt,
    index: number,
    textId: string,
    expanded: boolean,
    callbacks: PromptCardCallbacks
  ): HTMLElement {
    const autoPaste = isPromptAutoPaste(prompt);
    const autoSubmit = isPromptAutoSubmit(prompt);

    const composer = element('div', 'composer');
    composer.classList.toggle('is-expanded', expanded);

    const text = element('p', 'composer__text');
    text.id = textId;
    // Where the pasted text lands ({{args}} or the end of the prompt). Styled as a text slot, not like the
    // "auto paste" setting badge below, and named after what it holds: the input box text or the clipboard.
    const slotLabel = getMessage('options_preview_slot');
    const slotHint = getMessage('options_preview_slot_hint');
    getPromptPreviewSegments(asText(prompt.prompt), autoPaste).forEach((segment) => {
      if (segment.type === 'text') {
        text.append(segment.value);
        return;
      }

      const token = element('span', segment.type === 'args' ? 'token token--slot' : 'token token--slot token--appended');
      token.title = segment.type === 'args' ? `${ARGS_PLACEHOLDER} · ${slotHint}` : slotHint;
      token.append(createIcon('text-cursor', 'icon token__icon'), slotLabel);
      text.append(token);
    });

    const foot = element('div', 'composer__foot');
    const meta = element('div', 'composer__meta');

    const expandToggle = element('button', 'composer__expand');
    expandToggle.type = 'button';
    expandToggle.hidden = true;
    expandToggle.setAttribute('aria-controls', textId);
    const syncExpandToggle = () => {
      const isExpanded = composer.classList.contains('is-expanded');
      expandToggle.textContent = getMessage(isExpanded ? 'options_prompt_collapse' : 'options_prompt_expand');
      expandToggle.setAttribute('aria-expanded', String(isExpanded));
    };
    syncExpandToggle();
    expandToggle.addEventListener('click', () => {
      const next = !composer.classList.contains('is-expanded');
      composer.classList.toggle('is-expanded', next);
      syncExpandToggle();
      callbacks.onExpandedChange(index, next);
    });
    meta.append(expandToggle);

    if (autoPaste) {
      const chip = element('span', 'chip chip--paste');
      chip.append(createIcon('clipboard'), element('span', undefined, getMessage('options_badge_auto_paste')));
      meta.append(chip);
    }

    // Mirrors ChatGPT's send button: filled when the prompt is sent automatically.
    const send = element('span', `send-state ${autoSubmit ? 'is-auto' : 'is-manual'}`);
    const sendButton = element('span', 'send-state__button');
    sendButton.setAttribute('aria-hidden', 'true');
    sendButton.append(createIcon('arrow-up'));
    send.append(
      element('span', 'send-state__label', getMessage(autoSubmit ? 'options_badge_auto_submit' : 'options_badge_manual_submit')),
      sendButton
    );

    foot.append(meta, send);
    composer.append(text, foot);
    return composer;
  }

  private createMoveButton(
    direction: 'up' | 'down',
    options: PromptCardOptions,
    describedBy: string,
    onClick: () => void
  ): HTMLButtonElement {
    const label = getMessage(direction === 'up' ? 'options_action_move_up' : 'options_action_move_down');
    const button = this.createIconButton(direction === 'up' ? 'chevron-up' : 'chevron-down', label, describedBy);
    button.dataset.action = direction === 'up' ? 'move-up' : 'move-down';

    if (!options.reorderEnabled) {
      // Stay focusable so the reason is announced (via the page's hidden hint) and shown as a tooltip.
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-describedby', `${REORDER_HINT_ID} ${describedBy}`);
      button.dataset.tooltip = getMessage('options_reorder_disabled_filtering');
    } else {
      const atEdge = direction === 'up' ? options.position === 0 : options.position >= options.groupSize - 1;
      button.disabled = atEdge;
    }

    button.addEventListener('click', () => {
      if (button.getAttribute('aria-disabled') === 'true') return;
      onClick();
    });
    return button;
  }

  private createIconButton(icon: IconName, label: string, describedBy: string, extraClass: string = ''): HTMLButtonElement {
    const button = element('button', `icon-btn has-tooltip ${extraClass}`.trim());
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.dataset.tooltip = label;
    button.setAttribute('aria-describedby', describedBy);
    button.append(createIcon(icon));
    return button;
  }
}
