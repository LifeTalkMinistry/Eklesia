import { useEffect, useRef, useState } from 'react';
import {
  PROFILE_LIMITS,
  updateLocalProfile,
  validateProfileFields,
} from '../services/profileService.js';
import AccessibleDialog from './AccessibleDialog.jsx';

function profileValues(profile) {
  return {
    displayName: profile?.displayName || '',
    churchName: profile?.churchName || '',
    ministryName: profile?.ministryName || '',
  };
}

export default function EditProfileDialog({ open, profile, onClose, onSaved, triggerRef }) {
  const [values, setValues] = useState(() => profileValues(profile));
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setValues(profileValues(profile));
    setErrors({});
    setMessage('');
    setConfirmDiscard(false);
  }, [open, profile]);

  const initial = profileValues(profile);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setMessage('');
    setConfirmDiscard(false);
  }

  function requestClose() {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  function handleSubmit(event) {
    event.preventDefault();
    const validation = validateProfileFields(values);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    const result = updateLocalProfile(validation.data);
    if (!result.ok) {
      setErrors(result.errors || {});
      setMessage(result.message || 'Your profile could not be saved on this device.');
      return;
    }

    onSaved(result.data, result);
    onClose();
  }

  return (
    <AccessibleDialog
      open={open}
      onRequestClose={requestClose}
      triggerRef={triggerRef}
      labelledBy="edit-profile-title"
      describedBy="edit-profile-description"
      initialFocusRef={nameRef}
    >
      <div className="alpha-dialog-topline">
        <div>
          <p className="dashboard-eyebrow">Personal setup for this device</p>
          <h2 id="edit-profile-title">Edit profile</h2>
        </div>
        <button className="alpha-dialog-close" type="button" onClick={requestClose} aria-label="Close profile editor">×</button>
      </div>
      <p id="edit-profile-description" className="alpha-dialog-copy">Changes update this browser only and do not remove any devotional history.</p>

      <form className="alpha-form alpha-dialog-form" onSubmit={handleSubmit} noValidate>
        <div className="alpha-field">
          <label htmlFor="edit-display-name">Your name</label>
          <input
            ref={nameRef}
            id="edit-display-name"
            name="displayName"
            type="text"
            autoComplete="name"
            maxLength={PROFILE_LIMITS.displayName.max}
            value={values.displayName}
            onChange={updateField}
            aria-invalid={Boolean(errors.displayName)}
            aria-describedby={errors.displayName ? 'edit-display-name-error' : undefined}
          />
          {errors.displayName ? <p id="edit-display-name-error" className="alpha-field-error" role="alert">{errors.displayName}</p> : null}
        </div>
        <div className="alpha-field">
          <label htmlFor="edit-church-name">Church <span className="alpha-optional">Optional</span></label>
          <input
            id="edit-church-name"
            name="churchName"
            type="text"
            maxLength={PROFILE_LIMITS.churchName.max}
            value={values.churchName}
            onChange={updateField}
            aria-invalid={Boolean(errors.churchName)}
          />
          {errors.churchName ? <p className="alpha-field-error" role="alert">{errors.churchName}</p> : null}
        </div>
        <div className="alpha-field">
          <label htmlFor="edit-ministry-name">Ministry or group <span className="alpha-optional">Optional</span></label>
          <input
            id="edit-ministry-name"
            name="ministryName"
            type="text"
            maxLength={PROFILE_LIMITS.ministryName.max}
            value={values.ministryName}
            onChange={updateField}
            aria-invalid={Boolean(errors.ministryName)}
          />
          {errors.ministryName ? <p className="alpha-field-error" role="alert">{errors.ministryName}</p> : null}
        </div>

        {confirmDiscard ? (
          <div className="alpha-discard-confirmation" role="alert">
            <strong>Discard unsaved changes?</strong>
            <p>Your saved device profile will remain unchanged.</p>
            <div>
              <button className="secondary-button" type="button" onClick={() => setConfirmDiscard(false)}>Keep editing</button>
              <button className="alpha-text-danger" type="button" onClick={onClose}>Discard changes</button>
            </div>
          </div>
        ) : null}
        {message ? <p className="alpha-inline-message" role="status">{message}</p> : null}

        <div className="alpha-dialog-actions">
          <button className="secondary-button" type="button" onClick={requestClose}>Cancel</button>
          <button className="primary-button" type="submit">Save changes</button>
        </div>
      </form>
    </AccessibleDialog>
  );
}
