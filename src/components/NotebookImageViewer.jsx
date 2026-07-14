import { useEffect, useRef, useState } from 'react';
import { getNotebookImage } from '../services/notebookImageService.js';
import AccessibleDialog from './AccessibleDialog.jsx';

export default function NotebookImageViewer({
  imageId,
  refreshKey = 0,
  onRemoveBrokenReference,
  onCloseEntry,
}) {
  const [status, setStatus] = useState(imageId ? 'loading' : 'removed');
  const [objectUrl, setObjectUrl] = useState('');
  const [viewerOpen, setViewerOpen] = useState(false);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let url = '';

    if (!imageId) {
      setStatus('removed');
      setObjectUrl('');
      return undefined;
    }

    setStatus('loading');
    setObjectUrl('');
    getNotebookImage(imageId).then((result) => {
      if (cancelled) return;
      if (!result.ok || !(result.data?.blob instanceof Blob)) {
        setStatus('missing');
        return;
      }
      url = URL.createObjectURL(result.data.blob);
      setObjectUrl(url);
      setStatus('ready');
    });

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [imageId, refreshKey]);

  if (status === 'loading') {
    return <div className="notebook-viewer-state" role="status">Loading notebook photo…</div>;
  }

  if (status === 'removed') {
    return (
      <div className="notebook-viewer-state notebook-viewer-removed">
        <strong>Notebook photo removed</strong>
        <p>The Journey entry remains available without the image.</p>
      </div>
    );
  }

  if (status === 'missing') {
    return (
      <div className="notebook-viewer-state notebook-viewer-missing" role="status">
        <strong>Notebook photo unavailable</strong>
        <p>The saved image could not be found on this device. The devotion record is still available in Journey.</p>
        <div className="notebook-inline-actions">
          <button className="secondary-button" type="button" onClick={onRemoveBrokenReference}>Remove broken photo reference</button>
          <button className="notebook-text-button" type="button" onClick={onCloseEntry}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <figure className="notebook-viewer-figure">
        <img src={objectUrl} alt="Your handwritten notebook devotion" />
        <figcaption>
          <button ref={triggerRef} className="secondary-button" type="button" onClick={() => setViewerOpen(true)}>
            Open full photo
          </button>
        </figcaption>
      </figure>
      <AccessibleDialog
        open={viewerOpen}
        onRequestClose={() => setViewerOpen(false)}
        triggerRef={triggerRef}
        labelledBy="notebook-image-viewer-title"
        initialFocusRef={closeRef}
        className="notebook-image-dialog"
      >
        <div className="alpha-dialog-topline">
          <h2 id="notebook-image-viewer-title">Notebook devotion photo</h2>
          <button ref={closeRef} className="alpha-dialog-close" type="button" onClick={() => setViewerOpen(false)} aria-label="Close notebook photo">×</button>
        </div>
        <div className="notebook-full-image-scroll">
          <img src={objectUrl} alt="Your handwritten notebook devotion" />
        </div>
        <button className="primary-button notebook-dialog-done" type="button" onClick={() => setViewerOpen(false)}>Close</button>
      </AccessibleDialog>
    </>
  );
}
