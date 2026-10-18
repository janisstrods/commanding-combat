import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/oswald/400.css';
import '@fontsource/oswald/500.css';
import '@fontsource/oswald/600.css';
import '@fontsource/oswald/700.css';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/400-italic.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-sans-3/700.css';
import { App } from './ui/App';

// A tab left open across a deploy asks for chunks the new build no longer has (each map, the lazy screens): reload once
// to get the new build instead of showing the error screen. At most once a minute, so a real outage cannot loop.
window.addEventListener('vite:preloadError', (e) => {
  const KEY = 'cce-reloaded-at';
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0);
  } catch {
    return;
  }
  if (Date.now() - last < 60_000) return;
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return;
  }
  e.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
