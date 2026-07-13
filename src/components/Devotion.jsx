import { useState } from 'react';

export default function Devotion({ devotion, reflection, setReflection, completed, onComplete, onBack, onReadChapter }) {
  const [message, setMessage] = useState('');

  function submitReflection(event) {
    event.preventDefault();
    const wordCount = reflection.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount < 10) {
      setMessage('Write at least one clear thought about what this passage reminded you of.');
      return;
    }
    setMessage('');
    onComplete();
  }

  if (!devotion) {
    return <main className="devotion-shell"><div className="devotion-frame"><header className="devotion-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to dashboard">←</button><div><p>Personal devotion</p><strong>Scripture unavailable</strong></div></header><p className="page-error" role="alert">The selected Scripture could not be loaded. Please return and choose a verse again.</p></div></main>;
  }

  const devotionLabel = devotion.devotionType === 'personal' ? 'My chosen devotion' : 'Today’s suggested devotion';

  return (
    <main className="devotion-shell">
      <div className="devotion-frame">
        <header className="devotion-header"><button className="icon-button" type="button" onClick={onBack} aria-label="Back to dashboard">←</button><div><p>{devotionLabel}</p><strong>{devotion.title}</strong></div><span className="soft-badge">5 min</span></header>
        <article className="scripture-card">
          <p className="dashboard-eyebrow">{devotion.reference} · BSB</p>
          <blockquote>“{devotion.text}”</blockquote>
          <button className="secondary-button" type="button" onClick={onReadChapter}>Read full chapter</button>
        </article>
        <section className="devotion-reading">
          <p><b>Theme:</b> {devotion.theme}</p>
          <p><b>Eklesia reflection prompt:</b> {devotion.prompt}</p>
          <p className="privacy-note">The Scripture text above is from the Berean Standard Bible. The reflection question is an Eklesia prompt, and your answer remains private.</p>
        </section>
        <form className="reflection-form" onSubmit={submitReflection}>
          <label htmlFor="reflection">Write your personal devotion</label>
          <p>Your answer remains private unless you choose to share it later.</p>
          <textarea id="reflection" value={reflection} onChange={(event) => setReflection(event.target.value)} placeholder="Write one honest takeaway..." rows="7" />
          {message && <p className="form-message error-message">{message}</p>}
          {completed ? <div className="review-result"><span aria-hidden="true">✓</span><div><strong>Today&apos;s devotion is complete</strong><p>Your personal reflection has been kept private.</p></div></div> : <button className="primary-button submit-button" type="submit">Complete today’s devotion</button>}
        </form>
      </div>
    </main>
  );
}
