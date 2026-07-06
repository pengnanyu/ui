/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
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
  // App/灏忕▼搴忔ā寮忎笅涓嶇敤 StrictMode锛岄伩鍏嶅弻閲嶆覆鏌撳鑷?WebView 鎬ц兘闂
  createRoot(rootEl).render(<App />);
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// 娉ㄥ唽 Service Worker锛歐eb 鐙珛璁块棶鍜?iframe 宓屽叆妯″紡閮芥敞鍐岋紝Android WebView 鍜屽皬绋嬪簭涓嶆敞鍐?if (!isApp() && !isMiniProgram() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { });
  });
}
