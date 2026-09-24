import {
  THEME_STORAGE_KEY,
  applyThemePreference,
  getThemeStorage,
  parseThemePreference,
  readThemePreference,
  writeThemePreference,
  type ThemePreference,
} from '../utils/theme';

/**
 * Wires the System / Light / Dark radio group to the stored theme preference.
 */
export class ThemeSwitcher {
  private readonly inputs: HTMLInputElement[];

  constructor(private readonly root: HTMLElement = document.documentElement, inputName: string = 'theme') {
    this.inputs = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="radio"][name="${inputName}"]`));
  }

  init(): void {
    this.apply(readThemePreference(getThemeStorage()));

    this.inputs.forEach((input) => {
      input.addEventListener('change', () => {
        if (!input.checked) return;
        const preference = parseThemePreference(input.value);
        writeThemePreference(getThemeStorage(), preference);
        this.apply(preference);
      });
    });

    // Keep other open options tabs in sync.
    window.addEventListener('storage', (event) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
      this.apply(readThemePreference(getThemeStorage()));
    });
  }

  private apply(preference: ThemePreference): void {
    applyThemePreference(this.root, preference);
    this.inputs.forEach((input) => {
      input.checked = input.value === preference;
    });
  }
}
