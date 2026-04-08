// PWA install prompt — capture beforeinstallprompt early so any component can trigger it.

let _prompt = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _prompt = e;
    window.dispatchEvent(new Event('pwa:installable'));
  });

  window.addEventListener('appinstalled', () => {
    _prompt = null;
    window.dispatchEvent(new Event('pwa:installed'));
  });
}

export function isInstallable() {
  return _prompt !== null;
}

export async function promptInstall() {
  if (!_prompt) return false;
  _prompt.prompt();
  const { outcome } = await _prompt.userChoice;
  if (outcome === 'accepted') _prompt = null;
  return outcome === 'accepted';
}

export function isRunningStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export async function clearAppCache() {
  if ('caches' in window) {
    const names = await caches.keys();
    await Promise.all(names.map(n => caches.delete(n)));
  }
}
