import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ConnectXOSLab } from './components/ConnectXOSLab.tsx';
import { ConnectXSetup } from './components/ConnectXSetup.tsx';
import { ConnectXStorefront } from './components/ConnectXStorefront.tsx';
import { ConnectXGrowthLab } from './components/ConnectXGrowthLab.tsx';
import './index.css';

const params = new URLSearchParams(window.location.search);
const showConnectXOS = params.get('connectx_os') === '1';
const showConnectXSetup = params.get('connectx_setup') === '1';
const showConnectXStore = params.get('connectx_store') === '1';
const showConnectXGrowth = params.get('connectx_growth') === '1';

const root = showConnectXSetup
  ? <ConnectXSetup />
  : showConnectXStore
    ? <ConnectXStorefront />
    : showConnectXGrowth
      ? <ConnectXGrowthLab />
      : showConnectXOS
        ? <ConnectXOSLab />
        : <App />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>{root}</StrictMode>,
);
