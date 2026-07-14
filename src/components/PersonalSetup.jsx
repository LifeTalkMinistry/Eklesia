import { useEffect, useRef, useState } from 'react';
import { PROFILE_LIMITS, validateProfileFields } from '../services/profileService.js';

export default function PersonalSetup({ profile, storageAvailable, onContinue, onBack }) {
  const [values, setValues] = useState({
    displayName: profile?.displayName || '',
    churchName: profile?.churchName || '',
    ministryName: profile?.ministryName || '',
  });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setMessage('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    const validation = validateProfileFields(values);
    if (!validation.ok) {
      setErrors(validation.errors);
      return;
    }

    const result = onContinue(validation.data);
    if (!result?.ok) {
      setErrors(result?.errors || {});
      setMessage(result?.message || 'Your profile could not be saved on this device.');
      return;
    }

    if (!result.persisted && result.message) setMessage(result.message);
  }

  return (
    <main className="app-shell welcome-shell alpha-flow-shell">
      <section className="welcome-card alpha-setup-card">
        <p className="eyebrow">PERSONAL SETUP</p>
        <h1>Welcome to Ekklesia Pulse</h1>
        <p className="description">Tell us what you would like to be called on this device.</p>

        <form className="alpha-form" onSubmit={handleSubmit} noValidate>
          <div className="alpha-field">
            <label htmlFor="setup-display-name">Your name <span aria-hidden="true">*</span></label>
            <input
              ref={nameRef}
              id="setup-display-name"
              name="displayName"
              type="text"
              autoComplete="name"
              maxLength={PROFILE_LIMITS.displayName.max}
              placeholder="Example: Maria"
              value={values.displayName}
              onChange={updateField}
              aria-invalid={Boolean(errors.displayName)}
              aria-describedby={errors.displayName ? 'setup-display-name-error' : undefined}
            />
            {errors.displayName ? <p id="setup-display-name-error" className="alpha-field-error" role="alert">{errors.displayName}</p> : null}
          </div>

          <div className="alpha-field">
            <label htmlFor="setup-church-name">Church <span className="alpha-optional">Optional</span></label>
            <input
              id="setup-church-name"
              name="churchName"
              type="text"
              maxLength={PROFILE_LIMITS.churchName.max}
              placeholder="Example: Amazing Hope"
              value={values.churchName}
              onChange={updateField}
              aria-invalid={Boolean(errors.churchName)}
              aria-describedby={errors.churchName ? 'setup-church-name-error' : undefined}
            />
            {errors.churchName ? <p id="setup-church-name-error" className="alpha-field-error" role="alert">{errors.churchName}</p> : null}
          </div>

          <div className="alpha-field">
            <label htmlFor="setup-ministry-name">Ministry or group <span className="alpha-optional">Optional</span></label>
            <input
              id="setup-ministry-name"
              name="ministryName"
              type="text"
              maxLength={PROFILE_LIMITS.ministryName.max}
              placeholder="Example: Music Team"
              value={values.ministryName}
              onChange={updateField}
              aria-invalid={Boolean(errors.ministryName)}
              aria-describedby={errors.ministryName ? 'setup-ministry-name-error' : undefined}
            />
            {errors.ministryName ? <p id="setup-ministry-name-error" className="alpha-field-error" role="alert">{errors.ministryName}</p> : null}
          </div>

          <p className="alpha-supporting-note">
            {storageAvailable
              ? 'This does not create an online account. Your information is currently saved only in this browser.'
              : 'This does not create an online account. This browser is preventing permanent saving, so this setup may last only for this session.'}
          </p>
          {message ? <p className="alpha-inline-message" role="status">{message}</p> : null}

          <div className="alpha-form-actions">
            <button className="secondary-button" type="button" onClick={onBack}>Back</button>
            <button className="primary-button" type="submit">Continue</button>
          </div>
        </form>
      </section>
    </main>
  );
}
