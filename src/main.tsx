import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { isApp, isMiniProgram } from './utils/platform';
import './styles/globals.css';
import './styles/breakpoints.css';
import './styles/card.css';
import './styles/themes/light.css';
import './styles/themes/dark.css';
import './i18n';

(function() {
  try {
    var p = new URLSearchParams(window.location.search);
    var t = p.get('theme');
    if (t !== 'light' && t !== 'dark') t = localStorage.getItem('bms-theme');
    if (t !== 'light' && t !== 'dark') t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch(e) { document.documentElement.setAttribute('data-theme', 'light'); }
})();

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

const rootEl = document.getElementById('root')!;
if (isApp() || isMiniProgram()) {
  // App/小程序模式下不用 StrictMode，避免双重渲染导致 WebView 性能问题
  createRoot(rootEl).render(<App />);
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// 注册 Service Worker：Web 独立访问和 iframe 嵌入模式都注册，Android WebView 和小程序不注册
if (!isApp() && !isMiniProgram() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { });
  });
}
