import React from 'react';
import ReactDOM from 'react-dom';
import App from './App.jsx';
import './Library.scss';
import { ReactLenis } from '@studio-freight/react-lenis';
import { BrowserRouter } from 'react-router-dom';

ReactDOM.render(
  <ReactLenis root>
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  </ReactLenis>,
  document.getElementById('root')
);