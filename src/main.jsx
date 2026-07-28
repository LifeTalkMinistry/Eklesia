import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { runBrandMigration } from './services/brandMigration.js';
import { initializeFontPreferences } from './services/fontPreferencesService.js';
import { initializeThemePreferences } from './services/themePreferencesService.js';
import './index.css';
import './alpha.css';
import './together-demo-disclosure.css';
import './member-visitor-progress.css';
import './devotion-choice.css';
import './bible-return.css';
import './wgap.css';
import './journey-history.css';
import './journey-cabinets.css';
import './journey-share.css';
import './devotion-complete.css';
import './rhythm-sync.css';
import './additional-devotion.css';
import './devotion-flip.css';
import './notebook-devotion.css';
import './font-preferences.css';
import './theme-system.css';
import './theme-primitives.css';
import './theme-semantic.css';
import './theme-component-tokens.css';
import './theme-light.css';
import './theme-preferences.css';

runBrandMigration();
initializeThemePreferences();
initializeFontPreferences();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
