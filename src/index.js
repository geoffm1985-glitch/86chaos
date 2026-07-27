import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./styles.css";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/firebase-messaging-sw.js', { updateViaCache: 'none' })
      .then((registration) => registration.update?.().catch(() => null))
      .catch((error) => console.warn('86 Chaos service worker registration failed:', error?.message || error));
  }, { once: true });
}

