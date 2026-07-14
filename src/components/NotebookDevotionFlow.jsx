import { useEffect, useRef, useState } from 'react';
import { saveNotebookDevotion } from '../services/devotionService.js';
import { processNotebookImage } from '../services/imageProcessingService.js';
import { deleteNotebookImage, saveNotebookImage } from '../services/notebookImageService.js';
import NotebookCapture from './NotebookCapture.jsx';
import NotebookDevotionDetails from './NotebookDevotionDetails.jsx';
import NotebookPreview from './NotebookPreview.jsx';

function createSubmissionKey() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function NotebookDevotionFlow({
  initialFile,
  onCancel,
  onSaved,
  onReturnHome,
  onViewJourney,
}) {
  const [stage, setStage] = useState(initialFile ? 'processing' : 'capture');
  const [processedImage, setProcessedImage] = useState(null);
  const [details, setDetails] = useState({ reference: '', title: '', note: '' });
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savedResult, setSavedResult] = useState(null);
  const submissionKeyRef = useRef(createSubmissionKey());
  const initialFileProcessedRef = useRef(false);

  async function processFile(file) {
    if (!file) return;
    setMessage('');
    setStage('processing');
    const result = await processNotebookImage(file);
    if (!result.ok) {
      setProcessedImage(null);
      setMessage(result.error.message);
      setStage('capture');
      return;
    }
    setProcessedImage(result.data);
    setStage('preview');
  }

  useEffect(() => {
    if (initialFile && !initialFileProcessedRef.current) {
      initialFileProcessedRef.current = true;
      processFile(initialFile);
    }
    // initialFile is intentionally processed only when this flow mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveDevotion(nextDetails) {
    if (!processedImage?.blob || isSaving) return;
    setIsSaving(true);
    setMessage('');
    setDetails(nextDetails);

    const imageResult = await saveNotebookImage(processedImage.blob, processedImage);
    if (!imageResult.ok) {
      setMessage(imageResult.error.message);
      setIsSaving(false);
      return;
    }

    try {
      const result = saveNotebookDevotion({
        ...nextDetails,
        imageId: imageResult.data.id,
      }, { submissionKey: submissionKeyRef.current });

      if (result.isDuplicate && result.entry.imageId !== imageResult.data.id) {
        const cleanup = await deleteNotebookImage(imageResult.data.id);
        if (!cleanup.ok) console.warn('A duplicate notebook image could not be cleaned up.', cleanup.error);
      }

      setSavedResult(result);
      setStage('success');
      setProcessedImage(null);
      onSaved?.(result);
    } catch (error) {
      const cleanup = await deleteNotebookImage(imageResult.data.id);
      if (!cleanup.ok) console.warn('A notebook image could not be removed after metadata saving failed.', cleanup.error);
      console.error('Notebook devotion metadata could not be saved.', error);
      setMessage('The notebook devotion could not be saved. The temporary photo was removed, and you can try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function startAnother() {
    submissionKeyRef.current = createSubmissionKey();
    setProcessedImage(null);
    setDetails({ reference: '', title: '', note: '' });
    setSavedResult(null);
    setMessage('');
    setStage('capture');
  }

  if (stage === 'preview' && processedImage) {
    return (
      <NotebookPreview
        processedImage={processedImage}
        onReplace={processFile}
        onContinue={() => setStage('details')}
        onCancel={onCancel}
      />
    );
  }

  if (stage === 'details' && processedImage) {
    return (
      <NotebookDevotionDetails
        initialValues={details}
        onSave={saveDevotion}
        onBack={() => setStage('preview')}
        onCancel={onCancel}
        saving={isSaving}
        error={message}
      />
    );
  }

  if (stage === 'success' && savedResult) {
    const additional = savedResult.type === 'additional';
    return (
      <main className="devotion-shell notebook-flow-shell">
        <div className="devotion-frame notebook-flow-frame">
          <section className="notebook-success-card" aria-live="polite">
            <span className="notebook-success-icon" aria-hidden="true">✓</span>
            <p className="eyebrow">NOTEBOOK DEVOTION</p>
            <h1>{additional ? 'Notebook devotion saved' : 'Daily rhythm complete'}</h1>
            <p>{additional
              ? 'This has been added privately to your Journey as an additional devotion.'
              : 'Your handwritten devotion has been saved privately in Journey.'}</p>
            <div className="notebook-success-actions">
              <button className="primary-button" type="button" onClick={onReturnHome}>Return home</button>
              <button className="secondary-button" type="button" onClick={() => onViewJourney?.(savedResult.entry.id)}>View in Journey</button>
              <button className="secondary-button" type="button" onClick={startAnother}>Add another devotion</button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="devotion-shell notebook-flow-shell">
      <div className="devotion-frame notebook-flow-frame">
        <header className="devotion-header">
          <button className="icon-button" type="button" onClick={onCancel} aria-label="Back to devotion choices">←</button>
          <div><p>WRITTEN DEVOTION</p><h1>Capture my notebook</h1></div>
        </header>
        <section className="notebook-capture-card">
          <span className="notebook-capture-icon" aria-hidden="true">▤</span>
          <h2>{stage === 'processing' ? 'Preparing your notebook photo…' : 'Take or choose a notebook photo'}</h2>
          <p>Take a photo of your handwritten devotion and save it privately in Journey.</p>
          {stage === 'processing' ? (
            <p className="notebook-processing-status" role="status" aria-live="polite">Preparing your notebook photo…</p>
          ) : (
            <NotebookCapture onFileSelected={processFile} buttonClassName="primary-button" />
          )}
          {message ? <p className="form-message error-message" role="alert">{message}</p> : null}
          <p className="notebook-privacy-panel">Your notebook photo stays private on this device and will not appear in Together.</p>
          <p className="notebook-desktop-note">On computers, you can choose an existing photo.</p>
        </section>
      </div>
    </main>
  );
}
