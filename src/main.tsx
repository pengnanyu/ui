import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { isWeb } from './utils/platform';
import './styles/globals.css';
import './styles/breakpoints.css';
import './styles/card.css';
import './styles/themes/light.css';
import './styles/themes/dark.css';
import './i18n';

document.documentElement.setAttribute('data-theme', 'light');

function setupViewportUnit() {
  const update = () => {
    const vh = window.visualViewport ? window.visualViewport.height * 0.01 : window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  update();
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', update);
    window.visualViewport.addEventListener('scroll', update);
  } else {
    window.addEventListener('resize', update);
  }
}

setupViewportUnit();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if (isWeb() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { });
  });
}
