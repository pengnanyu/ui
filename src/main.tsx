import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/globals.css';
import './styles/breakpoints.css';
import './styles/card.css';
import './styles/themes/light.css';
import './styles/themes/dark.css';
import './i18n';

document.documentElement.setAttribute('data-theme', 'light');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);