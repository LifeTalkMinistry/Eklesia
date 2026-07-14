import { useId, useRef } from 'react';

export default function NotebookCapture({
  onFileSelected,
  buttonLabel = 'Open camera',
  buttonClassName = 'primary-button',
  disabled = false,
  describedBy,
  buttonRef,
  children,
}) {
  const inputId = useId();
  const inputRef = useRef(null);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleChange(event) {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (file) onFileSelected?.(file);
  }

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        className="notebook-file-input"
        type="file"
        accept="image/*"
        capture="environment"
        aria-describedby={describedBy}
        onChange={handleChange}
        tabIndex="-1"
      />
      <button ref={buttonRef} className={buttonClassName} type="button" onClick={openPicker} disabled={disabled}>
        {children || buttonLabel}
      </button>
    </>
  );
}
