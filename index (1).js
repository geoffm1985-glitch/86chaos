// 86 Chaos mobile viewport guard.
// Keeps the app from pinch/double-tap zooming on phones so buttons and kitchen screens stay stable.

const isLikelyMobileDevice = () => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return Boolean(
    navigator.maxTouchPoints > 1 ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
  );
};

export function installMobileNoZoomGuard() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!isLikelyMobileDevice()) return;
  if (window.__chaosMobileNoZoomGuardInstalled) return;
  window.__chaosMobileNoZoomGuardInstalled = true;

  const ensureViewport = () => {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    viewport.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
    );
  };

  ensureViewport();

  const blockPinchZoom = (event) => {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault();
    }
  };

  const blockGestureZoom = (event) => {
    event.preventDefault();
  };

  let lastTouchEnd = 0;
  const blockDoubleTapZoom = (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 350) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  };

  document.addEventListener('touchmove', blockPinchZoom, { passive: false });
  document.addEventListener('touchend', blockDoubleTapZoom, { passive: false });
  document.addEventListener('gesturestart', blockGestureZoom, { passive: false });
  document.addEventListener('gesturechange', blockGestureZoom, { passive: false });
  document.addEventListener('gestureend', blockGestureZoom, { passive: false });
}
