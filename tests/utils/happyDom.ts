import { GlobalRegistrator } from '@happy-dom/global-registrator';

const REGISTRY_KEY = '__chatgpttoolkit_happyDomRegistered';

export function ensureHappyDom() {
  const registry = globalThis as Record<string, unknown>;
  if (registry[REGISTRY_KEY]) return;

  try {
    GlobalRegistrator.register();
  } catch (error) {
    if (error instanceof Error && error.message.includes('already been globally registered')) {
      registry[REGISTRY_KEY] = true;
      return;
    }
    throw error;
  }

  registry[REGISTRY_KEY] = true;
}
