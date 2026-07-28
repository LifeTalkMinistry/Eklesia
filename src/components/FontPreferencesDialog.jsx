import { useEffect, useMemo, useRef, useState } from 'react';
import {
  applyFontPreferences,
  FONT_OPTIONS,
  getFontOption,
  getFontPreferences,
  saveFontPreferences,
} from '../services/fontPreferencesService.js';
import AccessibleDialog from './AccessibleDialog.jsx';

export default function FontPreferencesDialog({ open, onClose, triggerRef }) {
  const [initialFontId, setInitialFontId] = useState('pulse-default');
  const [selectedFontId, setSelectedFontId] = useState('pulse-default');
  const [message, setMessage] = useState('');
  const firstOptionRef = useRef(null);
  const selectedFont = useMemo(() => getFontOption(selectedFontId), [selectedFontId]);

  useEffect(() => {
    if (!open) return;
    const preferences = getFontPreferences();
    setInitialFontId(preferences.fontId);
    setSelectedFontId(preferences.fontId);
    setMessage('');
    applyFontPreferences(preferences);
  }, [open]);

  function previewFont(fontId) {
    setSelectedFontId(fontId);
    setMessage('');
    applyFontPreferences({ fontId });
  }

  function requestClose() {
    applyFontPreferences({ fontId: initialFontId });
    onClose();
  }

  function saveSelection() {
    const result = saveFontPreferences({ fontId: selectedFontId });
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
      labelledBy="font-preferences-title"
      describedBy="font-preferences-description"
      initialFocusRef={firstOptionRef}
    >
      <div className="alpha-dialog-topline">
        <div>
          <p className="dashboard-eyebrow">Appearance on this device</p>
          <h2 id="font-preferences-title">Choose your font</h2>
        </div>
        <button className="alpha-dialog-close" type="button" onClick={requestClose} aria-label="Close font settings">×</button>
      </div>

      <p id="font-preferences-description" className="alpha-dialog-copy">
        Select a comfortable font for normal app text. Ekklesia Pulse branding and major display headings keep their original style.
      </p>

      <div className="font-preference-preview" style={{ fontFamily: selectedFont.family }} aria-live="polite">
        <span>Live preview</span>
        <strong>Faith grows through hearing the Word.</strong>
        <p>Read devotionals, Scripture, announcements, and reflections in a style that feels comfortable to you.</p>
      </div>

      <div className="font-option-list" role="radiogroup" aria-label="Available fonts">
        {FONT_OPTIONS.map((option, index) => (
          <button
            ref={index === 0 ? firstOptionRef : undefined}
            className={`font-option ${selectedFontId === option.id ? 'is-selected' : ''}`}
            type="button"
            role="radio"
            aria-checked={selectedFontId === option.id}
            key={option.id}
            onClick={() => previewFont(option.id)}
          >
            <span className="font-option-radio" aria-hidden="true" />
            <span className="font-option-copy">
              <b style={{ fontFamily: option.family }}>{option.label}</b>
              <small>{option.description}</small>
            </span>
            <span className="font-option-sample" style={{ fontFamily: option.family }} aria-hidden="true">Aa</span>
          </button>
        ))}
      </div>

      {message ? <p className="alpha-inline-message" role="status">{message}</p> : null}

      <div className="alpha-dialog-actions font-dialog-actions">
        <button className="secondary-button" type="button" onClick={requestClose}>Cancel</button>
        <button className="primary-button" type="button" onClick={saveSelection}>Save font</button>
      </div>
    </AccessibleDialog>
  );
}
