import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { installMobileNoZoomGuard } from "./core/mobileNoZoom";
import { firebaseEmulatorReadiness } from "./core/appCore";
import { firebaseRuntimeTarget } from "./core/firebaseTarget";
import "./styles.css";

installMobileNoZoomGuard();

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

const renderApp = () => root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
if (firebaseRuntimeTarget === 'EMULATOR') {
  firebaseEmulatorReadiness.then(renderApp).catch((error) => {
    console.error('86 Chaos Firebase Emulator startup failed:', error);
    root.render(<StrictMode><main data-testid="firebase-emulator-startup-failure" style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}><h1>Firebase Emulator Suite unavailable</h1><p>{String(error?.message || error)}</p><p>86 Chaos did not fall back to live Firebase.</p></main></StrictMode>);
  });
} else {
  renderApp();
}

if (firebaseRuntimeTarget === 'LIVE' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js', { updateViaCache: 'none' })
      .then((registration) => registration.update?.().catch(() => null))
      .catch((error) => console.warn('86 Chaos service worker registration failed:', error?.message || error));
  }, { once: true });
}

