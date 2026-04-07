import './styles/fonts.css';

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';

import './index.css'
import App from './App'

declare global {
  interface Window {
    __csp_nonce__?: string;
  }
}

(window as any).AG_GRID_CSP_NONCE = window.__csp_nonce__;

const muiCache = createCache({
  key: 'mui',
  nonce: window.__csp_nonce__, // De waarde die NPM heeft ingevuld
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CacheProvider value={muiCache}>
    <BrowserRouter>
      <App />
    </BrowserRouter>
    </CacheProvider>
  </StrictMode>
);