import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ConnectXHome } from './components/ConnectXHome.tsx';
import { ConnectXOSLab } from './components/ConnectXOSLab.tsx';
import { ConnectXSetup } from './components/ConnectXSetup.tsx';
import { ConnectXStorefront } from './components/ConnectXStorefront.tsx';
import { ConnectXGrowthLab } from './components/ConnectXGrowthLab.tsx';
import { ConnectXLocalApp } from './components/ConnectXLocalApp.tsx';
import { ConnectXRutasApp } from './components/ConnectXRutasApp.tsx';
import './index.css';

const params = new URLSearchParams(window.location.search);
const showConnectX = params.get('connectx') === '1';
const showConnectXOS = params.get('connectx_os') === '1';
const showConnectXSetup = params.get('connectx_setup') === '1';
const showConnectXStore = params.get('connectx_store') === '1';
const showConnectXGrowth = params.get('connectx_growth') === '1';
const showConnectXLocal = params.get('connectx_local') === '1';
const showConnectXRoutes = params.get('connectx_routes') === '1';

const root = showConnectXSetup
  ? <ConnectXSetup />
  : showConnectXStore
    ? <ConnectXStorefront />
    : showConnectXGrowth
      ? <ConnectXGrowthLab />
      : showConnectXLocal
        ? <ConnectXLocalApp />
        : showConnectXRoutes
          ? <ConnectXRutasApp />
          : showConnectXOS
            ? <ConnectXOSLab />
            : showConnectX
              ? <ConnectXHome />
              : <App />;

createRoot(document.getElementById('root')!).render(
  <StrictMode>{root}</StrictMode>,
);
