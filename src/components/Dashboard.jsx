import BibleReader from './BibleReader.jsx';
import TodayDevotionCard from './TodayDevotionCard.jsx';
import { formatManilaDate, getManilaGreeting } from '../lib/dailyVerse.js';

const week = [
  { day: 'M', complete: true }, { day: 'T', complete: true }, { day: 'W', complete: true },
  { day: 'T', complete: true }, { day: 'F', complete: true }, { day: 'S', complete: false },
  { day: 'S', complete: false },
];

function HomeDashboard({ dailyVerse, dailyLoading, dailyError, completed, onStartDevotion }) {
  return (
    <>
      <section className="greeting-block">
        <p className="dashboard-eyebrow">{formatManilaDate()}</p>
        <h2>{getManilaGreeting()}, Max.</h2>
        <p>Take a quiet moment. You do not have to rush your time with God.</p>
      </section>
      <TodayDevotionCard dailyVerse={dailyVerse} completed={completed} loading={dailyLoading} error={dailyError} onStart={onStartDevotion} />
      <section className="section-block">
        <div className="section-heading"><div><p className="dashboard-eyebrow">Your rhythm</p><h3>This week</h3></div><span className="week-score">5 of 7 days</span></div>
        <div className="week-row" aria-label="Weekly devotional consistency">
          {week.map((item, index) => <div className="day-item" key={`${item.day}-${index}`}><span className={`day-circle ${item.complete ? 'is-complete' : ''}`}>{item.complete ? '✓' : item.day}</span><small>{item.day}</small></div>)}
        </div>
      </section>
      <section className="stats-grid">
        <article className="stat-card"><span className="stat-icon" aria-hidden="true">🔥</span><strong>12</strong><p>day rhythm</p></article>
        <article className="stat-card"><span className="stat-icon" aria-hidden="true">✦</span><strong>4</strong><p>reflections</p></article>
        <article className="stat-card"><span className="stat-icon" aria-hidden="true">♡</span><strong>Steady</strong><p>growth signal</p></article>
      </section>
      <section className="encouragement-card"><span className="quote-mark" aria-hidden="true">“</span><p>Consistency is not about proving your faith. It is about making room to hear God again and again.</p><small>Eklesia reminder</small></section>
    </>
  );
}

function Journey() {
  return <section className="panel-page"><p className="dashboard-eyebrow">Your spiritual journey</p><h2>Small steps are becoming a rhythm.</h2><p className="panel-intro">Eklesia tracks the habit without exposing the private things you write.</p><div className="journey-progress-card"><div className="progress-ring" aria-label="71 percent weekly consistency"><span>71%</span></div><div><p className="dashboard-eyebrow">Weekly consistency</p><h3>Growing steadily</h3><p>You completed five meaningful devotional reflections this week.</p></div></div><div className="privacy-card"><span aria-hidden="true">🔒</span><div><h3>Your reflections stay private</h3><p>Leaders can see your consistency status, not your personal journal entries.</p></div></div></section>;
}

function Community() {
  return <section className="panel-page"><p className="dashboard-eyebrow">Healthy encouragement</p><h2>You are growing with a community.</h2><p className="panel-intro">This space will help members encourage one another without comparing streaks.</p><div className="empty-state-card"><span className="empty-state-icon" aria-hidden="true">◎</span><h3>Encouragement circles are coming</h3><p>Share prayer support and gentle encouragement with people you trust.</p></div></section>;
}

function Profile() {
  return <section className="panel-page"><p className="dashboard-eyebrow">Your account</p><h2>Max Emorej</h2><p className="panel-intro">Member · LifeTalk Ministry</p><div className="settings-list"><button type="button"><span><b>Reflection privacy</b><small>Private by default</small></span><span aria-hidden="true">›</span></button><button type="button"><span><b>Devotional reminder</b><small>Every day at 7:00 AM</small></span><span aria-hidden="true">›</span></button><button type="button"><span><b>Church connection</b><small>LifeTalk Ministry</small></span><span aria-hidden="true">›</span></button></div></section>;
}

export default function Dashboard({ activeTab, setActiveTab, completed, onStartDevotion, onExit, dailyVerse, dailyLoading, dailyError, bibleTarget, onReturnFromBible }) {
  const content = {
    home: <HomeDashboard dailyVerse={dailyVerse} dailyLoading={dailyLoading} dailyError={dailyError} completed={completed} onStartDevotion={onStartDevotion} />,
    journey: <Journey />,
    bible: <BibleReader target={bibleTarget} onReturn={onReturnFromBible} />,
    community: <Community />,
    profile: <Profile />,
  }[activeTab];

  return (
    <main className="dashboard-shell">
      <div className="dashboard-frame">
        <header className="dashboard-header">
          <button className="brand-button" type="button" onClick={onExit} aria-label="Return to welcome screen"><span className="brand-mark">E</span><span>Eklesia</span></button>
          <button className="notification-button" type="button" aria-label="Notifications"><span aria-hidden="true">⌁</span><i /></button>
        </header>
        <div className="dashboard-content">{content}</div>
        <nav className="bottom-nav" aria-label="Main navigation">
          {[
            ['home', '⌂', 'Home'], ['journey', '◔', 'Journey'], ['bible', '✦', 'Bible'], ['community', '♧', 'Together'], ['profile', '○', 'Profile'],
          ].map(([id, icon, label]) => <button className={activeTab === id ? 'active' : ''} type="button" key={id} onClick={() => setActiveTab(id)}><span aria-hidden="true">{icon}</span><small>{label}</small></button>)}
        </nav>
      </div>
    </main>
  );
}
