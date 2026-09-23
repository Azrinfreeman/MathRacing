import './app/styles/app.css';
import { AppController } from './app/AppController';
import type { CurriculumRegistry } from './curriculum/registry';
import { getDefaultRegistry } from './curriculum/registry';
import { createTranslator } from './locales';
import { createRepository } from './storage/IndexedDbSessionRepository';
import { SettingsStore } from './storage/settings';

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) throw new Error('#app container is missing from index.html');

  const settings = new SettingsStore(undefined, (e) => console.warn('settings storage problem', e));
  const lang = settings.load().language;
  const t = createTranslator(lang);
  document.documentElement.lang = lang === 'en' ? 'en' : 'ms';

  // Validate the curriculum packs up front: a malformed pack fails fast in development and shows a safe message in production.
  let registry: CurriculumRegistry;
  try {
    registry = getDefaultRegistry();
  } catch (error) {
    console.error('Curriculum pack error', error);
    document.getElementById('splash')?.remove();
    if (import.meta.env.DEV) throw error;
    root.textContent = t('app.packError');
    return;
  }

  const { repository, warning } = await createRepository();
  if (warning) console.warn(warning);

  const app = new AppController(root, {
    registry,
    repository,
    settings,
    storageWarning: warning ? t('app.storageWarning') : null,
    // The pointer diagnostic exists only in development builds and only with ?diag in the address.
    devDiagnostics: import.meta.env.DEV && new URLSearchParams(window.location.search).has('diag'),
  });
  await app.start();

  if (import.meta.env.PROD) {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({
      immediate: true,
      onOfflineReady: () => {
        const el = document.getElementById('toasts');
        if (el) {
          const msg = document.createElement('div');
          msg.className = 'toast toast-info';
          msg.setAttribute('role', 'status');
          msg.textContent = t('app.offlineReady');
          el.appendChild(msg);
          setTimeout(() => msg.remove(), 6000);
        }
        document.documentElement.dataset.offlineReady = 'true';
      },
      onRegisterError: (error) => console.warn('service worker registration failed', error),
    });
  }
}

boot().catch((error: unknown) => {
  console.error(error);
  const root = document.getElementById('app');
  if (root)
    root.textContent = `MathRacing: ${error instanceof Error ? error.message : String(error)}`;
});
