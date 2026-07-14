import { useEffect, useState } from 'react';
import { formatImageSize } from '../services/imageProcessingService.js';
import NotebookCapture from './NotebookCapture.jsx';

export default function NotebookPreview({
  processedImage,
  onReplace,
  onContinue,
  onCancel,
  heading = 'Review your photo',
  eyebrow = 'NOTEBOOK DEVOTION',
  continueLabel = 'Use this photo',
}) {
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!processedImage?.blob) return undefined;
    const objectUrl = URL.createObjectURL(processedImage.blob);
    setPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setPreviewUrl('');
    };
  }, [processedImage?.blob]);

  return (
    <main className="devotion-shell notebook-flow-shell">
      <div className="devotion-frame notebook-flow-frame">
        <header className="devotion-header">
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Cancel notebook devotion">×</button>
          <div><p>{eyebrow}</p><h1>{heading}</h1></div>
        </header>

        <section className="notebook-flow-content">
          <div className="notebook-preview-card">
            {previewUrl ? (
              <img
                className="notebook-preview-image"
                src={previewUrl}
                alt="Preview of your handwritten notebook devotion"
              />
            ) : (
              <p className="status-message" role="status">Preparing your notebook photo…</p>
            )}
          </div>
          <p className="notebook-image-meta">
            Processed photo · {formatImageSize(processedImage?.sizeBytes)} · {processedImage?.width} × {processedImage?.height}
          </p>

          <div className="notebook-flow-actions notebook-preview-actions">
            <NotebookCapture
              onFileSelected={onReplace}
              buttonLabel="Retake photo"
              buttonClassName="secondary-button"
            />
            <button className="primary-button" type="button" onClick={onContinue}>{continueLabel}</button>
            <button className="notebook-text-button" type="button" onClick={onCancel}>Cancel</button>
          </div>
          <p className="notebook-desktop-note">On computers, you can choose an existing photo.</p>
        </section>
      </div>
    </main>
  );
}
