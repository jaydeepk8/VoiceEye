import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './Library.scss';
import { ReactLenis } from '@studio-freight/react-lenis';
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')).render(
  <ReactLenis root>
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  </ReactLenis>
);
