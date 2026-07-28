import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyThemePreferences,
  getThemeOption,
  getThemePreferences,
  saveThemePreferences,
  THEME_OPTIONS,
} from '../services/themePreferencesService.js';
import AccessibleDialog from './AccessibleDialog.jsx';

export default function ThemePreferencesDialog({ open, onClose, triggerRef }) {
  const [initialThemeId, setInitialThemeId] = useState('pulse-dark');
  const [selectedThemeId, setSelectedThemeId] = useState('pulse-dark');
  const [message, setMessage] = useState('');
  const firstOptionRef = useRef(null);
  const selectedTheme = useMemo(() => getThemeOption(selectedThemeId), [selectedThemeId]);

  useEffect(() => {
    if (!open) return;
    const preferences = getThemePreferences();
    setInitialThemeId(preferences.themeId);
    setSelectedThemeId(preferences.themeId);
    setMessage('');
    applyThemePreferences(preferences);
  }, [open]);

  function previewTheme(themeId) {
    setSelectedThemeId(themeId);
    setMessage('');
    applyThemePreferences({ themeId });
  }

  function requestClose() {
    applyThemePreferences({ themeId: initialThemeId });
    onClose();
  }

  function saveSelection() {
    const result = saveThemePreferences({ themeId: selectedThemeId });
    if (result.persisted === false) {
      setMessage(result.message);
      return;
    }
    onClose();
  }

  return (
    <AccessibleDialog
      open={open}
      onRequestClose={requestClose}
      triggerRef={triggerRef}
      labelledBy="theme-preferences-title"
      describedBy="theme-preferences-description"
      initialFocusRef={firstOptionRef}
    >
      <div className="alpha-dialog-topline">
        <div>
          <p className="dashboard-eyebrow">Appearance on this device</p>
          <h2 id="theme-preferences-title">Choose your theme</h2>
        </div>
        <button className="alpha-dialog-close" type="button" onClick={requestClose} aria-label="Close theme settings">×</button>
      </div>

      <p id="theme-preferences-description" className="alpha-dialog-copy">
        Preview a complete color experience for personal pages, church spaces, Scripture, cards, navigation, forms, and dialogs.
      </p>

      <div className="theme-preview-panel" aria-live="polite">
        <div className="theme-preview-header">
          <span className="theme-preview-brand">E</span>
          <span>{selectedTheme.label}</span>
          <i aria-hidden="true" />
        </div>
        <div className="theme-preview-card">
          <small>Today’s Scripture</small>
          <strong>Walk faithfully in every season.</strong>
          <p>The selected font remains independent from the app theme.</p>
          <span>Continue</span>
        </div>
      </div>

      <div className="theme-option-grid" role="radiogroup" aria-label="Available app themes">
        {THEME_OPTIONS.map((option, index) => (
          <button
            ref={index === 0 ? firstOptionRef : undefined}
            className={`theme-option ${selectedThemeId === option.id ? 'is-selected' : ''}`}
            type="button"
            role="radio"
            aria-checked={selectedThemeId === option.id}
            key={option.id}
            onClick={() => previewTheme(option.id)}
          >
            <span className="theme-option-palette" aria-hidden="true">
              {option.preview.map((color) => <i key={color} style={{ background: color }} />)}
            </span>
            <span className="theme-option-copy">
              <b>{option.label}</b>
              <small>{option.description}</small>
            </span>
            <span className="theme-option-check" aria-hidden="true">✓</span>
          </button>
        ))}
      </div>

      {message ? <p className="alpha-inline-message" role="status">{message}</p> : null}

      <div className="alpha-dialog-actions theme-dialog-actions">
        <button className="secondary-button" type="button" onClick={requestClose}>Cancel</button>
        <button className="primary-button" type="button" onClick={saveSelection}>Save {selectedTheme.label}</button>
      </div>
    </AccessibleDialog>
  );
}
