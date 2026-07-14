import { useEffect, useRef } from 'react';
import './WhyEklesia.css';

export default function WhyEklesia({ open, onClose, triggerRef }) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusPanel = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
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
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  return (
    <div
      className="why-eklesia-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="why-eklesia-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="why-eklesia-title"
        aria-describedby="why-eklesia-intro"
        ref={panelRef}
      >
        <header className="why-eklesia-header">
          <div>
            <p className="why-eklesia-eyebrow">The heart behind the app</p>
            <h2 id="why-eklesia-title">Why Ekklesia Pulse?</h2>
          </div>
          <button
            className="why-eklesia-close"
            type="button"
            onClick={onClose}
            ref={closeButtonRef}
            aria-label="Close Why Ekklesia Pulse?"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="why-eklesia-content">
          <p className="why-eklesia-intro" id="why-eklesia-intro">
            Ekklesia Pulse was created to help people build a consistent devotional life and help church communities recognize when someone may need encouragement.
          </p>

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

          <button className="primary-button why-eklesia-continue" type="button" onClick={onClose}>
            Continue my journey
          </button>
        </div>
      </section>
    </div>
  );
}
