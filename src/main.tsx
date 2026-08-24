import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ConnectXOSLab } from './components/ConnectXOSLab.tsx';
import './index.css';

const params = new URLSearchParams(window.location.search);
const showConnectXOS = params.get('connectx_os') === '1';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {showConnectXOS ? <ConnectXOSLab /> : <App />}
  </StrictMode>,
);
