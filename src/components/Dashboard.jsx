import { useCallback, useRef, useState } from 'react';
import { APP_NAME } from '../config/appConfig.js';
import AlphaBadge from './AlphaBadge.jsx';
import AlphaInformation from './AlphaInformation.jsx';
import BibleReader from './BibleReader.jsx';
import DeleteLocalDataDialog from './DeleteLocalDataDialog.jsx';
import EditProfileDialog from './EditProfileDialog.jsx';
import FeedbackDialog from './FeedbackDialog.jsx';
import Journey from './Journey.jsx';
import RestartIntroductionDialog from './RestartIntroductionDialog.jsx';
import TodayDevotionCard from './TodayDevotionCard.jsx';
import Together from './Together.jsx';
import WhyEklesia from './WhyEklesia.jsx';
import { formatManilaDate, getManilaGreeting } from '../lib/manilaTime.js';
import { getDevotionMetrics } from '../services/devotionService.js';

function HomeDashboard({
  profile,
  dailyVerse,
  dailyLoading,
  dailyError,
  dailyRefreshing,
  dailyRefreshError,
  completed,
  officialDevotion,
  onStartDaily,
  onRefreshDaily,
  onReviewDaily,
  onSpendMore,
  devotionHistory,
}) {
  const rhythm = getDevotionMetrics(devotionHistory);
  const displayName = profile?.displayName || 'Friend';

  return (
    <>
      <section className="greeting-block">
        <p className="dashboard-eyebrow">{formatManilaDate()}</p>
        <h2>{getManilaGreeting()}, {displayName}.</h2>
      </section>
      <TodayDevotionCard
        dailyVerse={dailyVerse}
        officialDevotion={officialDevotion}
        completed={completed}
        loading={dailyLoading}
        error={dailyError}
        refreshing={dailyRefreshing}
        refreshError={dailyRefreshError}
        onRefresh={onRefreshDaily}
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

function TogetherDemoNotice() {
  const [expanded, setExpanded] = useState(false);
  const detailsId = 'together-demo-details';

  return (
    <aside className={`together-alpha-notice ${expanded ? 'is-expanded' : ''}`} aria-label="Together demonstration notice">
      <button
        className="together-alpha-disclosure"
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={detailsId}
      >
        <span className="alpha-badge">DEMO DATA</span>
        <span className="together-alpha-disclosure-label">What this means</span>
        <span className="together-alpha-disclosure-icon" aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>
      {expanded ? (
        <div className="together-alpha-notice-details" id={detailsId}>
          <strong>Together is not connected to live church members.</strong>
          <p>The church organization, ministries, roles, codes, visibility settings, and Church Pulse shown here are a local UI prototype. The connected version will require secure accounts and the Ekklesia Pulse backend.</p>
        </div>
      ) : null}
    </aside>
  );
}

function Profile({
  profile,
  storageAvailable,
  onProfileUpdated,
  onRestartIntroduction,
  onDeleteLocalData,
}) {
  const [dialog, setDialog] = useState('');
  const editRef = useRef(null);
  const alphaRef = useRef(null);
  const feedbackRef = useRef(null);
  const restartRef = useRef(null);
  const deleteRef = useRef(null);
  const displayName = profile?.displayName || 'Friend';
  const churchName = profile?.churchName || '';
  const ministryName = profile?.ministryName || '';

  return (
    <section className="panel-page alpha-profile-page">
      <div className="alpha-profile-heading">
        <div>
          <p className="dashboard-eyebrow">Personal setup for this device</p>
          <h2>{displayName}</h2>
          <p className="panel-intro">{churchName ? `Member · ${churchName}` : 'Ekklesia Pulse member'}</p>
          {ministryName ? <p className="alpha-ministry-label">{ministryName}</p> : null}
        </div>
        <AlphaBadge />
      </div>

      {!storageAvailable ? (
        <p className="alpha-storage-warning" role="status">
          This browser is currently preventing Ekklesia Pulse from saving information. Changes may remain only during this session.
        </p>
      ) : null}

      <section className="alpha-profile-card" aria-labelledby="device-profile-heading">
        <p className="dashboard-eyebrow">Local identity</p>
        <h3 id="device-profile-heading">About this device profile</h3>
        <dl className="alpha-profile-details">
          <div><dt>Name</dt><dd>{displayName}</dd></div>
          <div><dt>Church</dt><dd>{churchName || 'Not added'}</dd></div>
          <div><dt>Ministry or group</dt><dd>{ministryName || 'Not added'}</dd></div>
          <div><dt>App stage</dt><dd>Private Alpha</dd></div>
          <div><dt>Storage</dt><dd>{storageAvailable ? 'Local to this browser' : 'Temporary session storage'}</dd></div>
        </dl>
      </section>

      <div className="settings-list alpha-settings-list">
        <button ref={editRef} type="button" onClick={() => setDialog('edit')}>
          <span><b>Edit profile</b><small>Change the name, church, or ministry used on this device</small></span><span aria-hidden="true">›</span>
        </button>
        <button ref={alphaRef} type="button" onClick={() => setDialog('alpha')}>
          <span><b>About the Private Alpha</b><small>Review local storage, test scope, and current limitations</small></span><span aria-hidden="true">›</span>
        </button>
        <button ref={feedbackRef} type="button" onClick={() => setDialog('feedback')}>
          <span><b>Send alpha feedback</b><small>Share or copy a privacy-safe diagnostic message</small></span><span aria-hidden="true">›</span>
        </button>
        <button ref={restartRef} type="button" onClick={() => setDialog('restart')}>
          <span><b>Restart introduction</b><small>Show the welcome and alpha information screens again without deleting your devotions</small></span><span aria-hidden="true">›</span>
        </button>
      </div>

      <section className="alpha-data-controls" aria-labelledby="data-controls-heading">
        <p className="dashboard-eyebrow">Data controls</p>
        <h3 id="data-controls-heading">Information saved by Ekklesia Pulse</h3>
        <p>Devotions, WGAP reflections, notebook photos, Journey history, Bible position, profile details, and the Together demo state remain in this browser. There is no cloud backup.</p>
        <button ref={deleteRef} className="alpha-delete-trigger" type="button" onClick={() => setDialog('delete')}>Delete my local data</button>
      </section>

      <EditProfileDialog
        open={dialog === 'edit'}
        profile={profile}
        onClose={() => setDialog('')}
        onSaved={onProfileUpdated}
        triggerRef={editRef}
      />
      <AlphaInformation
        mode="dialog"
        open={dialog === 'alpha'}
        onClose={() => setDialog('')}
        triggerRef={alphaRef}
      />
      <FeedbackDialog
        open={dialog === 'feedback'}
        onClose={() => setDialog('')}
        triggerRef={feedbackRef}
        currentSection="Profile"
      />
      <RestartIntroductionDialog
        open={dialog === 'restart'}
        onClose={() => setDialog('')}
        onRestart={onRestartIntroduction}
        triggerRef={restartRef}
      />
      <DeleteLocalDataDialog
        open={dialog === 'delete'}
        onClose={() => setDialog('')}
        onDelete={onDeleteLocalData}
        triggerRef={deleteRef}
      />
    </section>
  );
}

export default function Dashboard({
  profile,
  storageAvailable,
  activeTab,
  setActiveTab,
  completed,
  officialDevotion,
  onStartDaily,
  onReviewDaily,
  onSpendMore,
  onExit,
  onProfileUpdated,
  onRestartIntroduction,
  onDeleteLocalData,
  dailyVerse,
  dailyLoading,
  dailyError,
  dailyRefreshing,
  dailyRefreshError,
  onRefreshDaily,
  bibleTarget,
  bibleSelectionMode,
  onSelectBibleVerse,
  onCancelBibleSelection,
  onReturnFromBible,
  devotionHistory,
  selectedHistoryId,
  onSelectHistoryEntry,
  onCloseHistoryEntry,
  onHistoryEntryUpdated,
}) {
  const [showWhyEklesia, setShowWhyEklesia] = useState(false);
  const whyEklesiaButtonRef = useRef(null);
  const closeWhyEklesia = useCallback(() => setShowWhyEklesia(false), []);

  const content = {
    home: <HomeDashboard profile={profile} dailyVerse={dailyVerse} dailyLoading={dailyLoading} dailyError={dailyError} dailyRefreshing={dailyRefreshing} dailyRefreshError={dailyRefreshError} completed={completed} officialDevotion={officialDevotion} onStartDaily={onStartDaily} onRefreshDaily={onRefreshDaily} onReviewDaily={onReviewDaily} onSpendMore={onSpendMore} devotionHistory={devotionHistory} />,
    journey: <Journey history={devotionHistory} selectedEntryId={selectedHistoryId} onSelectEntry={onSelectHistoryEntry} onCloseEntry={onCloseHistoryEntry} onEntryUpdated={onHistoryEntryUpdated} />,
    bible: <BibleReader target={bibleTarget} selectionMode={bibleSelectionMode} onSelectVerse={onSelectBibleVerse} onCancelSelection={onCancelBibleSelection} onReturn={onReturnFromBible} />,
    community: <><TogetherDemoNotice /><Together profile={profile} /></>,
    profile: <Profile profile={profile} storageAvailable={storageAvailable} onProfileUpdated={onProfileUpdated} onRestartIntroduction={onRestartIntroduction} onDeleteLocalData={onDeleteLocalData} />,
  }[activeTab];

  return (
    <main className="dashboard-shell">
      <div className="dashboard-frame">
        <header className="dashboard-header">
          <div className="alpha-brand-cluster">
            <button className="brand-button" type="button" onClick={onExit} aria-label="Return to welcome screen"><span className="brand-mark">E</span><span>{APP_NAME}</span></button>
            <AlphaBadge compact />
          </div>
          <button className="notification-button why-eklesia-trigger" type="button" aria-label="Why Ekklesia Pulse?" onClick={() => setShowWhyEklesia(true)} ref={whyEklesiaButtonRef}>
            <span className="information-glyph" aria-hidden="true">i</span>
          </button>
        </header>
        <div className="dashboard-content">
          {!storageAvailable ? (
            <p className="alpha-storage-warning alpha-dashboard-storage-warning" role="status">
              This browser is currently preventing Ekklesia Pulse from saving information. You may explore the app, but your progress may not remain after closing it.
            </p>
          ) : null}
          {content}
        </div>
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
