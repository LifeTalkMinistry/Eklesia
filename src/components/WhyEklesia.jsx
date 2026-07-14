import { useEffect, useRef } from 'react';
import AlphaBadge from './AlphaBadge.jsx';
import './WhyEklesia.css';
import './WhyEklesiaOnboarding.css';

export default function WhyEklesia({
  open = false,
  onClose,
  triggerRef,
  mode = 'dialog',
  onContinue,
}) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);
  const isOnboarding = mode === 'onboarding';
  const visible = isOnboarding || open;
  const continueAction = isOnboarding ? onContinue : onClose;

  useEffect(() => {
    if (!visible || isOnboarding) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusPanel = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusableElements = panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      if (!focusableElements.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusPanel);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;

      window.requestAnimationFrame(() => {
        const focusTarget = triggerRef?.current || previouslyFocused;
        focusTarget?.focus?.();
      });
    };
  }, [visible, isOnboarding, onClose, triggerRef]);

  useEffect(() => {
    if (!visible || !isOnboarding) return undefined;

    window.scrollTo({ top: 0, behavior: 'auto' });
    const focusPanel = window.requestAnimationFrame(() => panelRef.current?.focus());
    return () => window.cancelAnimationFrame(focusPanel);
  }, [visible, isOnboarding]);

  if (!visible) return null;

  return (
    <div
      className={isOnboarding ? 'why-eklesia-onboarding' : 'why-eklesia-overlay'}
      onMouseDown={isOnboarding ? undefined : (event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className={`why-eklesia-panel ${isOnboarding ? 'why-eklesia-onboarding-panel' : ''}`}
        role={isOnboarding ? 'region' : 'dialog'}
        aria-modal={isOnboarding ? undefined : true}
        aria-labelledby="why-eklesia-title"
        aria-describedby="why-eklesia-intro"
        ref={panelRef}
        tabIndex={isOnboarding ? -1 : undefined}
      >
        <header className="why-eklesia-header">
          <div>
            <p className="why-eklesia-eyebrow">The heart behind the app</p>
            <h2 id="why-eklesia-title">Why Ekklesia Pulse?</h2>
          </div>
          {!isOnboarding ? (
            <button
              className="why-eklesia-close"
              type="button"
              onClick={onClose}
              ref={closeButtonRef}
              aria-label="Close Why Ekklesia Pulse?"
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
        </header>

        <div className="why-eklesia-content">
          <p className="why-eklesia-intro" id="why-eklesia-intro">
            Ekklesia Pulse was created to help people build a consistent devotional life and help church communities recognize when someone may need encouragement.
          </p>

          <aside className="why-alpha-note" aria-label="Private Alpha information">
            <AlphaBadge />
            <p>Ekklesia Pulse is currently being tested as a local prototype. Secure church accounts and live accountability synchronization are still in development.</p>
          </aside>

          <section className="why-eklesia-section" aria-labelledby="why-eklesia-mission">
            <p className="why-eklesia-label">Our mission</p>
            <h3 id="why-eklesia-mission">Help people make room for God consistently.</h3>
            <p>Ekklesia Pulse helps church members develop a meaningful devotional rhythm through Scripture, reflection, and gentle accountability—without turning spiritual growth into pressure, competition, or performance.</p>
          </section>

          <section className="why-eklesia-section" aria-labelledby="why-eklesia-vision">
            <p className="why-eklesia-label">Our vision</p>
            <h3 id="why-eklesia-vision">A church where no one quietly disappears.</h3>
            <p>We envision churches where members feel spiritually supported, leaders recognize when encouragement may be needed, and people are gently invited to begin again.</p>
          </section>

          <section className="why-eklesia-section why-eklesia-creator" aria-labelledby="why-eklesia-creator">
            <p className="why-eklesia-label">A note from the creator</p>
            <h3 className="visually-hidden" id="why-eklesia-creator">Creator’s intent</h3>
            <div className="why-eklesia-note">
              <p>I created Ekklesia Pulse because spiritual growth should never feel like pressure.</p>
              <p>Sometimes people do not need to be confronted. They need to be remembered, encouraged, and gently invited to begin again.</p>
              <p>Ekklesia Pulse helps leaders encourage consistently and helps members build a rhythm without feeling condemned.</p>
              <p>You are not being measured by your streak. The streak is only a reminder that you continue to make room for God.</p>
              <div className="why-eklesia-signature">
                <strong>Max Emorej</strong>
                <span>Creator of Ekklesia Pulse</span>
              </div>
            </div>
          </section>

          <aside className="why-eklesia-reminder" aria-label="Final reminder">
            <strong>Your relationship with God cannot be reduced to a score.</strong>
            <p>Ekklesia Pulse does not measure the depth of your faith. It simply helps you keep showing up, reflect honestly, and stay connected to a community that cares.</p>
          </aside>

          <button className="primary-button why-eklesia-continue" type="button" onClick={continueAction}>
            {isOnboarding ? 'Enter Ekklesia Pulse' : 'Continue my journey'}
          </button>
        </div>
      </section>
    </div>
  );
}
