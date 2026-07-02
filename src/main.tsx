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

function hideMobileAddressBar() {
  if (!/Mobi|Android/i.test(navigator.userAgent)) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;

  if (window.self !== window.top) {
    try {
      window.parent.postMessage({ type: 'bms:hide-address-bar' }, '*');
    } catch { /* cross-origin */ }
    return;
  }

  const tryHide = () => {
    if (document.documentElement.scrollHeight <= window.innerHeight) return;
    window.scrollTo(0, 1);
  };

  window.addEventListener('load', () => {
    setTimeout(tryHide, 300);
    setTimeout(tryHide, 800);
    setTimeout(tryHide, 1500);
  });
}

function setupIframeTouchForward() {
  if (!/Mobi|Android/i.test(navigator.userAgent)) return;
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (window.self === window.top) return;

  let startY = 0;
  let active = false;

  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startY = e.touches[0]!.clientY;
    active = true;
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!active || e.touches.length !== 1) return;
    const deltaY = startY - e.touches[0]!.clientY;
    if (Math.abs(deltaY) > 15) {
      try {
        window.parent.postMessage({ type: 'bms:scroll-forward', deltaY: deltaY * 0.3 }, '*');
      } catch { /* cross-origin */ }
      startY = e.touches[0]!.clientY;
    }
  }, { passive: true });

  document.addEventListener('touchend', () => { active = false; }, { passive: true });
  document.addEventListener('touchcancel', () => { active = false; }, { passive: true });
}

function showViewportDebug() {
  if (!/Mobi|Android/i.test(navigator.userAgent)) return;
  if (window.self !== window.top) return;
  const panel = document.createElement('div');
  panel.id = 'vp-debug';
  panel.style.cssText = 'position:fixed;bottom:80px;left:4px;right:4px;z-index:99999;background:rgba(0,0,0,0.85);color:#0f0;font:10px/1.3 monospace;padding:4px 6px;pointer-events:none;border-radius:6px;max-height:120px;overflow:hidden;';
  document.body.appendChild(panel);

  const update = () => {
    const vv = window.visualViewport;
    const de = document.documentElement;
    const lines = [
      `innerH=${window.innerHeight} scrollY=${Math.round(window.scrollY)}`,
      `vv.h=${vv?.height?.toFixed(0)} vv.off=${vv?.offsetTop?.toFixed(0)}`,
      `--vh=${de.style.getPropertyValue('--vh').trim()}`,
      `docH=${de.scrollHeight} scrollable=${de.scrollHeight > window.innerHeight}`,
      `inIframe=${window.self !== window.top}`,
    ];
    panel.textContent = lines.join(' | ');
  };

  update();
  setInterval(update, 1000);
  window.addEventListener('resize', update);
  window.addEventListener('scroll', update);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', update);
    window.visualViewport.addEventListener('scroll', update);
  }
}

setupViewportUnit();
hideMobileAddressBar();
setupIframeTouchForward();
showViewportDebug();

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
