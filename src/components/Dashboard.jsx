import { useCallback, useRef, useState } from 'react';
import BibleReader from './BibleReader.jsx';
import DailyCheckInPortal from './DailyCheckInPortal.jsx';
import Journey from './Journey.jsx';
import TodayDevotionCard from './TodayDevotionCard.jsx';
import Together from './Together.jsx';
import WhyEklesia from './WhyEklesia.jsx';
import { formatManilaDate, getManilaGreeting } from '../lib/manilaTime.js';
import { getDevotionMetrics } from '../services/devotionService.js';

function HomeDashboard({
  dailyVerse,
  dailyLoading,
  dailyError,
  completed,
  officialDevotion,
  onStartDaily,
  onReviewDaily,
  onSpendMore,
  devotionHistory,
}) {
  const rhythm = getDevotionMetrics(devotionHistory);

  return (
    <>
      <section className="greeting-block">
        <p className="dashboard-eyebrow">{formatManilaDate()}</p>
        <h2>{getManilaGreeting()}, Max.</h2>
        <p>Start today with the Word, reflect, and respond.</p>
      </section>
      <TodayDevotionCard
        dailyVerse={dailyVerse}
        officialDevotion={officialDevotion}
        completed={completed}
        loading={dailyLoading}
        error={dailyError}
        onStart={onStartDaily}
        onReview={onReviewDaily}
        onSpendMore={onSpendMore}
      />
      <section className="section-block">
        <div className="section-heading">
          <div><p className="dashboard-eyebrow">Your rhythm</p><h3>This week</h3></div>
          <span className="week-score">{rhythm.weeklyCount} of 7 days</span>
        </div>
        <div className="week-row" aria-label={`${rhythm.weeklyCount} of 7 devotional days completed this week`}>
          {rhythm.week.map((item) => (
            <div className="day-item" key={item.dateKey}>
              <span
                className={`day-circle ${item.complete ? 'is-complete' : ''} ${item.isToday ? 'is-today' : ''} ${item.isFuture ? 'is-future' : ''}`}
                aria-label={`${item.dateKey}: ${item.complete ? 'devotion completed' : 'not completed'}`}
                aria-current={item.isToday ? 'date' : undefined}
              >
                {item.complete ? '✓' : item.label}
              </span>
              <small>{item.label}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="stats-grid">
        <article className="stat-card"><span className="stat-icon" aria-hidden="true">🔥</span><strong>{rhythm.currentStreak}</strong><p>day rhythm</p></article>
        <article className="stat-card"><span className="stat-icon" aria-hidden="true">✦</span><strong>{rhythm.savedCount}</strong><p>saved devotions</p></article>
        <article className="stat-card"><span className="stat-icon" aria-hidden="true">♡</span><strong>{rhythm.growthSignal}</strong><p>growth signal</p></article>
      </section>
      <section className="encouragement-card"><span className="quote-mark" aria-hidden="true">“</span><p>Consistency is not about proving your faith. It is about making room to hear God again and again.</p><small>Ekklesia Pulse reminder</small></section>
    </>
  );
}

function Profile() {
  return <section className="panel-page"><p className="dashboard-eyebrow">Your account</p><h2>Max Emorej</h2><p className="panel-intro">Member · LifeTalk Ministry</p><div className="settings-list"><button type="button"><span><b>Bible translation</b><small>Berean Standard Bible</small></span><span aria-hidden="true">›</span></button><button type="button"><span><b>Devotional reminder</b><small>Every day at 7:00 AM</small></span><span aria-hidden="true">›</span></button><button type="button"><span><b>Church connection</b><small>LifeTalk Ministry</small></span><span aria-hidden="true">›</span></button></div></section>;
}

export default function Dashboard({
  activeTab,
  setActiveTab,
  completed,
  officialDevotion,
  onStartDaily,
  onReviewDaily,
  onSpendMore,
  onExit,
  dailyVerse,
  dailyLoading,
  dailyError,
  bibleTarget,
  bibleSelectionMode,
  onSelectBibleVerse,
  onCancelBibleSelection,
  onReturnFromBible,
  devotionHistory,
  selectedHistoryId,
  onSelectHistoryEntry,
  onCloseHistoryEntry,
}) {
  const [showWhyEklesia, setShowWhyEklesia] = useState(false);
  const whyEklesiaButtonRef = useRef(null);
  const closeWhyEklesia = useCallback(() => setShowWhyEklesia(false), []);

  const content = {
    home: <HomeDashboard dailyVerse={dailyVerse} dailyLoading={dailyLoading} dailyError={dailyError} completed={completed} officialDevotion={officialDevotion} onStartDaily={onStartDaily} onReviewDaily={onReviewDaily} onSpendMore={onSpendMore} devotionHistory={devotionHistory} />,
    journey: <Journey history={devotionHistory} selectedEntryId={selectedHistoryId} onSelectEntry={onSelectHistoryEntry} onCloseEntry={onCloseHistoryEntry} />,
    bible: <BibleReader target={bibleTarget} selectionMode={bibleSelectionMode} onSelectVerse={onSelectBibleVerse} onCancelSelection={onCancelBibleSelection} onReturn={onReturnFromBible} />,
    community: <><Together /><DailyCheckInPortal /></>,
    profile: <Profile />,
  }[activeTab];

  return (
    <main className="dashboard-shell">
      <div className="dashboard-frame">
        <header className="dashboard-header">
          <button className="brand-button" type="button" onClick={onExit} aria-label="Return to welcome screen"><span className="brand-mark">E</span><span>Ekklesia Pulse</span></button>
          <button className="notification-button why-eklesia-trigger" type="button" aria-label="Why Ekklesia Pulse?" onClick={() => setShowWhyEklesia(true)} ref={whyEklesiaButtonRef}>
            <span className="information-glyph" aria-hidden="true">i</span>
          </button>
        </header>
        <div className="dashboard-content">{content}</div>
        <nav className="bottom-nav" aria-label="Main navigation">
          {[
            ['home', '⌂', 'Home'], ['journey', '◔', 'Journey'], ['bible', '✦', 'Bible'], ['community', '♧', 'Together'], ['profile', '○', 'Profile'],
          ].map(([id, icon, label]) => <button className={activeTab === id ? 'active' : ''} type="button" key={id} onClick={() => setActiveTab(id)}><span aria-hidden="true">{icon}</span><small>{label}</small></button>)}
        </nav>
        <WhyEklesia open={showWhyEklesia} onClose={closeWhyEklesia} triggerRef={whyEklesiaButtonRef} />
      </div>
    </main>
  );
}
