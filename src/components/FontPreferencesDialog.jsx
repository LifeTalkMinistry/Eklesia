import { useEffect, useMemo, useRef, useState } from 'react';
import { FONT_CATEGORIES } from '../config/fontCatalog.js';
import {
  applyFontPreferences,
  FONT_OPTIONS,
  getFontOption,
  getFontPreferences,
  loadFontOptions,
  saveFontPreferences,
} from '../services/fontPreferencesService.js';
import AccessibleDialog from './AccessibleDialog.jsx';

export default function FontPreferencesDialog({ open, onClose, triggerRef }) {
  const [initialFontId, setInitialFontId] = useState('pulse-default');
  const [selectedFontId, setSelectedFontId] = useState('pulse-default');
  const [activeCategory, setActiveCategory] = useState('popular');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const searchRef = useRef(null);
  const selectedFont = useMemo(() => getFontOption(selectedFontId), [selectedFontId]);
  const normalizedQuery = query.trim().toLowerCase();

  const filteredFonts = useMemo(() => {
    if (normalizedQuery) {
      return FONT_OPTIONS.filter((option) => (
        option.label.toLowerCase().includes(normalizedQuery)
        || option.description.toLowerCase().includes(normalizedQuery)
        || option.category.toLowerCase().includes(normalizedQuery)
      ));
    }
    return FONT_OPTIONS.filter((option) => option.category === activeCategory);
  }, [activeCategory, normalizedQuery]);

  useEffect(() => {
    if (!open) return;
    const preferences = getFontPreferences();
    const option = getFontOption(preferences.fontId);
    setInitialFontId(preferences.fontId);
    setSelectedFontId(preferences.fontId);
    setActiveCategory(option.category || 'popular');
    setQuery('');
    setMessage('');
    applyFontPreferences(preferences);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    loadFontOptions(filteredFonts);
  }, [filteredFonts, open]);

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
      initialFocusRef={searchRef}
    >
      <div className="alpha-dialog-topline">
        <div>
          <p className="dashboard-eyebrow">Appearance on this device</p>
          <h2 id="font-preferences-title">Choose your font</h2>
        </div>
        <button className="alpha-dialog-close" type="button" onClick={requestClose} aria-label="Close font settings">×</button>
      </div>

      <p id="font-preferences-description" className="alpha-dialog-copy">
        Browse {FONT_OPTIONS.length} fonts from familiar favorites to distinctive handwritten and display styles. Your choice changes the entire app except the Ekklesia Pulse brand at the top.
      </p>

      <div
        className="font-preference-preview"
        style={{ '--font-preview-family': selectedFont.family }}
        aria-live="polite"
      >
        <span>{selectedFont.label} · Live preview</span>
        <strong>Faith grows through hearing the Word.</strong>
        <p>Headings, buttons, Scripture, navigation, announcements, reflections, and other app text will use this font.</p>
      </div>

      <div className="font-library-controls">
        <label className="font-search-field" htmlFor="font-library-search">
          <span aria-hidden="true">⌕</span>
          <input
            ref={searchRef}
            id="font-library-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${FONT_OPTIONS.length} fonts`}
            autoComplete="off"
          />
          {query ? <button type="button" onClick={() => setQuery('')} aria-label="Clear font search">×</button> : null}
        </label>

        <div className="font-category-tabs" aria-label="Font categories">
          {FONT_CATEGORIES.map((category) => {
            const count = FONT_OPTIONS.filter((option) => option.category === category.id).length;
            return (
              <button
                className={!normalizedQuery && activeCategory === category.id ? 'is-active' : ''}
                type="button"
                key={category.id}
                aria-pressed={!normalizedQuery && activeCategory === category.id}
                onClick={() => {
                  setQuery('');
                  setActiveCategory(category.id);
                }}
              >
                {category.label} <small>{count}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="font-library-summary" aria-live="polite">
        <span>{filteredFonts.length} {filteredFonts.length === 1 ? 'font' : 'fonts'}</span>
        <small>{normalizedQuery ? `Search results for “${query.trim()}”` : FONT_CATEGORIES.find((category) => category.id === activeCategory)?.label}</small>
      </div>

      {filteredFonts.length ? (
        <div className="font-option-list" role="radiogroup" aria-label="Available fonts">
          {filteredFonts.map((option) => (
            <button
              className={`font-option ${selectedFontId === option.id ? 'is-selected' : ''}`}
              type="button"
              role="radio"
              aria-checked={selectedFontId === option.id}
              key={option.id}
              style={{ '--font-option-family': option.family }}
              onClick={() => previewFont(option.id)}
            >
              <span className="font-option-radio" aria-hidden="true" />
              <span className="font-option-copy">
                <b>{option.label}</b>
                <small>{option.description}</small>
              </span>
              <span className="font-option-sample" aria-hidden="true">Aa</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="font-library-empty" role="status">
          <strong>No matching font</strong>
          <p>Try a shorter name or browse one of the font categories.</p>
          <button className="secondary-button" type="button" onClick={() => setQuery('')}>Clear search</button>
        </div>
      )}

      {message ? <p className="alpha-inline-message" role="status">{message}</p> : null}

      <div className="alpha-dialog-actions font-dialog-actions">
        <button className="secondary-button" type="button" onClick={requestClose}>Cancel</button>
        <button className="primary-button" type="button" onClick={saveSelection}>Save {selectedFont.label}</button>
      </div>
    </AccessibleDialog>
  );
}
