import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { runBrandMigration } from './services/brandMigration.js';
import './index.css';
import './devotion-choice.css';
import './bible-return.css';
import './wgap.css';
import './journey-history.css';
import './devotion-complete.css';
import './rhythm-sync.css';
import './additional-devotion.css';

runBrandMigration();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
