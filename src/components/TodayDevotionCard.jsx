import { useState } from 'react';
import { getDailyDevotionReminder } from '../data/devotionReminders.js';
import { getManilaDateKey } from '../lib/manilaTime.js';

const REVEALED_SESSION_KEY = 'ekklesiaPulse.todayDevotionRevealedDate';

function wasRevealedToday(dateKey) {
  if (typeof window === 'undefined') return false;

  try {
    return window.sessionStorage.getItem(REVEALED_SESSION_KEY) === dateKey;
  } catch (error) {
    console.warn('Today’s devotion reveal state could not be restored.', error);
    return false;
  }
}

export default function TodayDevotionCard({
  dailyVerse,
  officialDevotion,
  completed,
  loading,
  error,
  refreshing,
  refreshError,
  onRefresh,
  onStart,
  onReview,
  onSpendMore,
}) {
  const dateKey = getManilaDateKey();
  const reminder = getDailyDevotionReminder(dateKey);
  const [revealed, setRevealed] = useState(() => wasRevealedToday(dateKey));

  function revealDevotion() {
    setRevealed(true);

    try {
      window.sessionStorage.setItem(REVEALED_SESSION_KEY, dateKey);
    } catch (storageError) {
      console.warn('Today’s devotion reveal state could not be saved.', storageError);
    }
  }

  if (dailyVerse && completed) {
    const reference = officialDevotion?.reference || dailyVerse.reference;
    return (
      <section className="today-card today-card-complete" aria-label="Today’s devotion is complete">
        <div className="completion-status-row">
          <span className="completion-check" aria-hidden="true">✓</span>
          <span className="completion-badge">Completed today</span>
        </div>

        <div className="completion-copy">
          <p className="verse-reference">{reference} · BSB</p>
          <h3>Devotion complete</h3>
        </div>

        <div className="additional-devotion-actions">
          <button className="card-button completion-review-button" type="button" onClick={onReview}>
            Review today’s devotion
            <span aria-hidden="true">→</span>
          </button>
          <button className="secondary-button spend-more-button" type="button" onClick={onSpendMore}>
            Spend more time in the Word
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className={`today-card-flip ${revealed ? 'is-revealed' : ''}`}>
      <div className="today-card-flip-inner">
        <button
          className="today-card today-card-face today-card-reminder"
          type="button"
          onClick={revealDevotion}
          aria-hidden={revealed}
          tabIndex={revealed ? -1 : 0}
          aria-label={`${reminder} Flip to start today’s devotion.`}
        >
          <span className="reminder-kicker">A gentle reminder</span>
          <span className="reminder-message">{reminder}</span>
          <span className="reminder-flip-prompt">
            <span>Flip to start today’s devotion</span>
            <span className="reminder-flip-icon" aria-hidden="true">↻</span>
          </span>
        </button>

        <section
          className="today-card today-card-face today-card-devotion"
          aria-busy={loading || refreshing}
          aria-hidden={!revealed}
        >
          <div className="today-card-topline">
            <span className="soft-badge">Today&apos;s devotion</span>
            <div className="daily-suggestion-tools">
              <button
                className={`daily-suggestion-refresh ${refreshing ? 'is-refreshing' : ''}`}
                type="button"
                onClick={onRefresh}
                disabled={loading || refreshing || !dailyVerse}
                aria-label={refreshing ? 'Loading another devotion suggestion' : 'Show another devotion suggestion'}
                title="Show another suggestion"
              >
                <span aria-hidden="true">↻</span>
              </button>
            </div>
          </div>

          {loading && <p className="status-message" aria-live="polite">Preparing today&apos;s Scripture…</p>}
          {error && <p className="status-message error-message" role="alert">Today&apos;s verse could not be loaded. Please try again shortly.</p>}
          {refreshError && <p className="suggestion-refresh-error" role="alert">{refreshError}</p>}

          {dailyVerse && (
            <>
              <p className="verse-reference">{dailyVerse.reference} · BSB</p>
              <h3>{dailyVerse.title}</h3>
              <p>{dailyVerse.theme} — {dailyVerse.prompt}</p>
              <button className="card-button" type="button" onClick={onStart} tabIndex={revealed ? 0 : -1}>
                Choose today’s devotion
                <span aria-hidden="true">→</span>
              </button>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
