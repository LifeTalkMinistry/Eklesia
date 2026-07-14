import NotebookCapture from './NotebookCapture.jsx';

export default function NotebookDevotionOption({ onPhotoSelected }) {
  return (
    <article className="devotion-option personal-option notebook-option">
      <div className="personal-option-heading">
        <span className="option-icon notebook-option-icon" aria-hidden="true">▤</span>
        <div>
          <p className="verse-reference">WRITTEN DEVOTION</p>
          <h3>Capture my notebook</h3>
        </div>
      </div>
      <p className="option-note">Take a photo of your handwritten devotion and save it privately in Journey.</p>
      <NotebookCapture
        onFileSelected={onPhotoSelected}
        buttonClassName="secondary-button choice-action"
        describedBy="notebook-choice-privacy"
      />
      <p className="notebook-privacy-note" id="notebook-choice-privacy">
        Your notebook photo stays private on this device and will not appear in Together.
      </p>
    </article>
  );
}
