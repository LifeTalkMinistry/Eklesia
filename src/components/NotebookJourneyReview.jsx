import { useEffect, useRef, useState } from 'react';
import {
  formatArchiveEntryDate,
  formatCompletionTime,
  updateNotebookImageReference,
} from '../services/devotionService.js';
import { processNotebookImage } from '../services/imageProcessingService.js';
import {
  deleteNotebookImage,
  getNotebookImage,
  replaceNotebookImage,
  restoreNotebookImageRecord,
  saveNotebookImage,
} from '../services/notebookImageService.js';
import AccessibleDialog from './AccessibleDialog.jsx';
import NotebookCapture from './NotebookCapture.jsx';
import NotebookImageViewer from './NotebookImageViewer.jsx';

function ReplacementPreview({ processedImage }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!processedImage?.blob) return undefined;
    const nextUrl = URL.createObjectURL(processedImage.blob);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [processedImage?.blob]);
  return url ? <img className="notebook-replacement-preview" src={url} alt="Preview of the replacement notebook photo" /> : null;
}

export default function NotebookJourneyReview({ entry, onBack, onEntryUpdated }) {
  const [message, setMessage] = useState('');
  const [messageError, setMessageError] = useState(false);
  const [processingReplacement, setProcessingReplacement] = useState(false);
  const [replacementImage, setReplacementImage] = useState(null);
  const [replaceDialogOpen, setReplaceDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewerRefreshKey, setViewerRefreshKey] = useState(0);
  const replaceTriggerRef = useRef(null);
  const replaceCancelRef = useRef(null);
  const deleteTriggerRef = useRef(null);
  const deleteCancelRef = useRef(null);

  async function prepareReplacement(file) {
    setProcessingReplacement(true);
    setMessage('Preparing your notebook photo…');
    setMessageError(false);
    const result = await processNotebookImage(file);
    setProcessingReplacement(false);
    if (!result.ok) {
      setMessage(result.error.message);
      setMessageError(true);
      return;
    }
    setReplacementImage(result.data);
    setMessage('');
    setReplaceDialogOpen(true);
  }

  async function confirmReplacement() {
    if (!replacementImage?.blob || busy) return;
    setBusy(true);
    setMessage('Replacing notebook photo…');
    setMessageError(false);

    if (entry.imageId) {
      const result = await replaceNotebookImage(entry.imageId, replacementImage.blob, replacementImage);
      if (!result.ok) {
        setMessage(result.error.message);
        setMessageError(true);
        setBusy(false);
        return;
      }
      setViewerRefreshKey((current) => current + 1);
      setReplaceDialogOpen(false);
      setReplacementImage(null);
      setMessage('Notebook photo replaced.');
      setBusy(false);
      return;
    }

    const saved = await saveNotebookImage(replacementImage.blob, replacementImage);
    if (!saved.ok) {
      setMessage(saved.error.message);
      setMessageError(true);
      setBusy(false);
      return;
    }

    try {
      const updated = updateNotebookImageReference(entry.id, saved.data.id);
      setReplaceDialogOpen(false);
      setReplacementImage(null);
      setMessage('Notebook photo added.');
      onEntryUpdated?.(updated);
    } catch (error) {
      const cleanup = await deleteNotebookImage(saved.data.id);
      if (!cleanup.ok) console.warn('A replacement notebook image could not be cleaned up.', cleanup.error);
      setMessage('The Journey entry could not be updated. The replacement photo was not kept.');
      setMessageError(true);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!entry.imageId || busy) return;
    setBusy(true);
    setMessage('Deleting notebook photo…');
    setMessageError(false);

    const existing = await getNotebookImage(entry.imageId);
    if (!existing.ok) {
      setMessage(existing.error.message);
      setMessageError(true);
      setBusy(false);
      return;
    }

    const deleted = await deleteNotebookImage(entry.imageId);
    if (!deleted.ok) {
      setMessage(deleted.error.message);
      setMessageError(true);
      setBusy(false);
      return;
    }

    try {
      const updated = updateNotebookImageReference(entry.id, null);
      setDeleteDialogOpen(false);
      setMessage('Notebook photo deleted. The Journey entry remains available.');
      onEntryUpdated?.(updated);
    } catch (error) {
      const restored = await restoreNotebookImageRecord(existing.data);
      if (!restored.ok) {
        console.warn('The notebook image could not be restored after metadata updating failed.', restored.error);
        setMessage('The photo was removed, but the Journey entry could not be updated completely.');
      } else {
        setMessage('The Journey entry could not be updated, so the original photo was restored.');
      }
      setMessageError(true);
    } finally {
      setBusy(false);
    }
  }

  function removeBrokenReference() {
    try {
      const updated = updateNotebookImageReference(entry.id, null);
      setMessage('Broken photo reference removed.');
      setMessageError(false);
      onEntryUpdated?.(updated);
    } catch (error) {
      console.error('Broken notebook image reference could not be removed.', error);
      setMessage('The broken photo reference could not be removed. Please try again.');
      setMessageError(true);
    }
  }

  const typeLabel = entry.type === 'additional' ? 'Additional devotion' : 'Daily devotion';

  return (
    <section className="panel-page journey-review-page notebook-journey-review">
      <div className="journey-review-toolbar">
        <button className="journey-back-button" type="button" onClick={onBack}>← Devotion history</button>
      </div>

      <header className="notebook-journey-heading">
        <p className="dashboard-eyebrow">Notebook devotion</p>
        <h2>{entry.title || 'Handwritten reflection'}</h2>
        <p>{formatArchiveEntryDate(entry.dateKey, entry.completedAt, { includeYear: true })} · {formatCompletionTime(entry.completedAt)} · {typeLabel}</p>
      </header>

      {entry.reference ? (
        <article className="notebook-detail-card">
          <span>Scripture reference</span>
          <strong>{entry.reference}</strong>
        </article>
      ) : null}

      {entry.note ? (
        <article className="notebook-detail-card">
          <span>Personal note</span>
          <p>{entry.note}</p>
        </article>
      ) : null}

      <NotebookImageViewer
        imageId={entry.imageId}
        refreshKey={viewerRefreshKey}
        onRemoveBrokenReference={removeBrokenReference}
        onCloseEntry={onBack}
      />

      <p className="notebook-journey-privacy">This notebook page is stored privately on this device and is not shared with your accountability circle.</p>
      {message ? <p className={`notebook-action-status ${messageError ? 'is-error' : ''}`} role={messageError ? 'alert' : 'status'}>{message}</p> : null}

      <div className="notebook-journey-actions">
        <NotebookCapture
          onFileSelected={prepareReplacement}
          buttonLabel={entry.imageId ? 'Replace notebook photo' : 'Add notebook photo'}
          buttonClassName="secondary-button"
          buttonRef={replaceTriggerRef}
          disabled={busy || processingReplacement}
        />
        {entry.imageId ? (
          <button ref={deleteTriggerRef} className="notebook-danger-button" type="button" onClick={() => setDeleteDialogOpen(true)} disabled={busy}>
            Delete notebook photo
          </button>
        ) : null}
      </div>
      {processingReplacement ? <p className="notebook-processing-status" role="status">Preparing your notebook photo…</p> : null}

      <AccessibleDialog
        open={replaceDialogOpen}
        onRequestClose={() => !busy && setReplaceDialogOpen(false)}
        triggerRef={replaceTriggerRef}
        labelledBy="replace-notebook-photo-title"
        describedBy="replace-notebook-photo-description"
        initialFocusRef={replaceCancelRef}
        className="notebook-confirm-dialog"
      >
        <h2 id="replace-notebook-photo-title">Replace this notebook photo?</h2>
        <p id="replace-notebook-photo-description">The current photo will be removed from this device and replaced with the new one.</p>
        <ReplacementPreview processedImage={replacementImage} />
        <div className="alpha-dialog-actions">
          <button ref={replaceCancelRef} className="secondary-button" type="button" onClick={() => setReplaceDialogOpen(false)} disabled={busy}>Cancel</button>
          <button className="primary-button" type="button" onClick={confirmReplacement} disabled={busy}>{busy ? 'Replacing…' : 'Replace photo'}</button>
        </div>
      </AccessibleDialog>

      <AccessibleDialog
        open={deleteDialogOpen}
        onRequestClose={() => !busy && setDeleteDialogOpen(false)}
        triggerRef={deleteTriggerRef}
        labelledBy="delete-notebook-photo-title"
        describedBy="delete-notebook-photo-description"
        initialFocusRef={deleteCancelRef}
        className="notebook-confirm-dialog"
      >
        <h2 id="delete-notebook-photo-title">Delete this notebook photo?</h2>
        <p id="delete-notebook-photo-description">The image will be permanently removed from this device. The Journey entry can remain without the photo.</p>
        <div className="alpha-dialog-actions">
          <button ref={deleteCancelRef} className="secondary-button" type="button" onClick={() => setDeleteDialogOpen(false)} disabled={busy}>Cancel</button>
          <button className="notebook-danger-button" type="button" onClick={confirmDelete} disabled={busy}>{busy ? 'Deleting…' : 'Delete photo'}</button>
        </div>
      </AccessibleDialog>
    </section>
  );
}
