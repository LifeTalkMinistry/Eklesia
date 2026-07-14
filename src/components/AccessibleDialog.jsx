import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export default function AccessibleDialog({
  open,
  onRequestClose,
  triggerRef,
  labelledBy,
  describedBy,
  className = '',
  initialFocusRef,
  children,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      (initialFocusRef?.current || dialogRef.current)?.focus?.();
    });

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onRequestClose?.();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = [...dialogRef.current.querySelectorAll(FOCUSABLE_SELECTOR)]
        .filter((element) => !element.hasAttribute('hidden'));
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        (triggerRef?.current || previouslyFocused)?.focus?.();
      });
    };
  }, [initialFocusRef, onRequestClose, open, triggerRef]);

  if (!open) return null;

  return (
    <div
      className="alpha-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onRequestClose?.();
      }}
    >
      <section
        ref={dialogRef}
        className={`alpha-dialog ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex="-1"
      >
        {children}
      </section>
    </div>
  );
}
