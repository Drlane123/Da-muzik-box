type PwaUpdateListener = (available: boolean) => void;

let registrationRef: ServiceWorkerRegistration | null = null;
const listeners = new Set<PwaUpdateListener>();

function notify() {
  const waiting = Boolean(registrationRef?.waiting);
  listeners.forEach((fn) => fn(waiting));
}

/** Register installable desktop PWA + listen for Cloudflare deploy updates. */
export async function registerDaMuzikBoxPwa(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    registrationRef = registration;

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          notify();
        }
      });
    });

    if (registration.waiting) notify();

    window.setInterval(() => {
      void registration.update();
    }, 60 * 60 * 1000);
  } catch {
    /* PWA optional — app still runs in browser tab */
  }
}

export function subscribePwaUpdate(listener: PwaUpdateListener): () => void {
  listeners.add(listener);
  listener(Boolean(registrationRef?.waiting));
  return () => listeners.delete(listener);
}

export function applyPwaUpdate(): void {
  const waiting = registrationRef?.waiting;
  if (!waiting) return;
  waiting.postMessage({ type: 'SKIP_WAITING' });
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      window.location.reload();
    },
    { once: true },
  );
}
