import { useState } from 'react';

const week = [
  { day: 'M', complete: true },
  { day: 'T', complete: true },
  { day: 'W', complete: true },
  { day: 'T', complete: true },
  { day: 'F', complete: true },
  { day: 'S', complete: false },
  { day: 'S', complete: false },
];

function Welcome({ onBegin }) {
  return (
    <main className="app-shell welcome-shell">
      <section className="welcome-card">
        <p className="eyebrow">A healthier way to grow together</p>
        <h1>Eklesia</h1>
        <p className="tagline">Track the habit. Protect the heart.</p>
        <p className="description">
          Build a consistent devotional life while keeping personal reflections
          private and helping church leaders know when encouragement may be needed.
        </p>
        <button className="primary-button" type="button" onClick={onBegin}>
          Begin your journey
        </button>
      </section>
    </main>
  );
}

function HomeDashboard({ completed, onStartDevotion }) {
  return (
    <>
      <section className="greeting-block">
        <p className="dashboard-eyebrow">Monday, July 13</p>
        <h2>Good morning, Max.</h2>
        <p>Take a quiet moment. You do not have to rush your time with God.</p>
      </section>

      <section className={`today-card ${completed ? 'today-card-complete' : ''}`}>
        <div className="today-card-topline">
          <span className="soft-badge">Today&apos;s devotion</span>
          <span className="reading-time">6 min read</span>
        </div>
        <p className="verse-reference">Psalm 46:10</p>
        <h3>{completed ? 'You showed up today.' : 'Be Still and Know'}</h3>
        <p>
          {completed
            ? 'Your reflection has been saved privately. Keep carrying today’s truth with you.'
            : 'A reminder that stillness is not wasted time—it is where we learn to recognize God’s presence.'}
        </p>
        <button className="card-button" type="button" onClick={onStartDevotion}>
          {completed ? 'View today’s reflection' : 'Start today’s devotion'}
          <span aria-hidden="true">→</span>
        </button>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="dashboard-eyebrow">Your rhythm</p>
            <h3>This week</h3>
          </div>
          <span className="week-score">5 of 7 days</span>
        </div>

        <div className="week-row" aria-label="Weekly devotional consistency">
          {week.map((item, index) => (
            <div className="day-item" key={`${item.day}-${index}`}>
              <span className={`day-circle ${item.complete ? 'is-complete' : ''}`}>
                {item.complete ? '✓' : item.day}
              </span>
              <small>{item.day}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-icon" aria-hidden="true">🔥</span>
          <strong>12</strong>
          <p>day rhythm</p>
        </article>
        <article className="stat-card">
          <span className="stat-icon" aria-hidden="true">✦</span>
          <strong>4</strong>
          <p>reflections</p>
        </article>
        <article className="stat-card">
          <span className="stat-icon" aria-hidden="true">♡</span>
          <strong>Steady</strong>
          <p>growth signal</p>
        </article>
      </section>

      <section className="encouragement-card">
        <span className="quote-mark" aria-hidden="true">“</span>
        <p>
          Consistency is not about proving your faith. It is about making room to
          hear God again and again.
        </p>
        <small>Eklesia reminder</small>
      </section>
    </>
  );
}

function Journey() {
  return (
    <section className="panel-page">
      <p className="dashboard-eyebrow">Your spiritual journey</p>
      <h2>Small steps are becoming a rhythm.</h2>
      <p className="panel-intro">
        Eklesia tracks the habit without exposing the private things you write.
      </p>

      <div className="journey-progress-card">
        <div className="progress-ring" aria-label="71 percent weekly consistency">
          <span>71%</span>
        </div>
        <div>
          <p className="dashboard-eyebrow">Weekly consistency</p>
          <h3>Growing steadily</h3>
          <p>You completed five meaningful devotional reflections this week.</p>
        </div>
      </div>

      <div className="privacy-card">
        <span aria-hidden="true">🔒</span>
        <div>
          <h3>Your reflections stay private</h3>
          <p>Leaders can see your consistency status, not your personal journal entries.</p>
        </div>
      </div>
    </section>
  );
}

function Community() {
  return (
    <section className="panel-page">
      <p className="dashboard-eyebrow">Healthy encouragement</p>
      <h2>You are growing with a community.</h2>
      <p className="panel-intro">
        This space will help members encourage one another without comparing streaks.
      </p>
      <div className="empty-state-card">
        <span className="empty-state-icon" aria-hidden="true">◎</span>
        <h3>Encouragement circles are coming</h3>
        <p>Share prayer support and gentle encouragement with people you trust.</p>
      </div>
    </section>
  );
}

function Profile() {
  return (
    <section className="panel-page">
      <p className="dashboard-eyebrow">Your account</p>
      <h2>Max Emorej</h2>
      <p className="panel-intro">Member · LifeTalk Ministry</p>

      <div className="settings-list">
        <button type="button">
          <span><b>Reflection privacy</b><small>Private by default</small></span>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button">
          <span><b>Devotional reminder</b><small>Every day at 7:00 AM</small></span>
          <span aria-hidden="true">›</span>
        </button>
        <button type="button">
          <span><b>Church connection</b><small>LifeTalk Ministry</small></span>
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  );
}

function Dashboard({ completed, onStartDevotion, onExit }) {
  const [activeTab, setActiveTab] = useState('home');

  const content = {
    home: <HomeDashboard completed={completed} onStartDevotion={onStartDevotion} />,
    journey: <Journey />,
    community: <Community />,
    profile: <Profile />,
  }[activeTab];

  return (
    <main className="dashboard-shell">
      <div className="dashboard-frame">
        <header className="dashboard-header">
          <button className="brand-button" type="button" onClick={onExit} aria-label="Return to welcome screen">
            <span className="brand-mark">E</span>
            <span>Eklesia</span>
          </button>
          <button className="notification-button" type="button" aria-label="Notifications">
            <span aria-hidden="true">⌁</span>
            <i />
          </button>
        </header>

        <div className="dashboard-content">{content}</div>

        <nav className="bottom-nav" aria-label="Main navigation">
          {[
            ['home', '⌂', 'Home'],
            ['journey', '◔', 'Journey'],
            ['community', '♧', 'Together'],
            ['profile', '○', 'Profile'],
          ].map(([id, icon, label]) => (
            <button
              className={activeTab === id ? 'active' : ''}
              type="button"
              key={id}
              onClick={() => setActiveTab(id)}
            >
              <span aria-hidden="true">{icon}</span>
              <small>{label}</small>
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}

function Devotion({ reflection, setReflection, completed, onComplete, onBack }) {
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

  return (
    <main className="devotion-shell">
      <div className="devotion-frame">
        <header className="devotion-header">
          <button className="icon-button" type="button" onClick={onBack} aria-label="Back to dashboard">←</button>
          <div>
            <p>Today&apos;s devotion</p>
            <strong>Be Still and Know</strong>
          </div>
          <span className="soft-badge">6 min</span>
        </header>

        <article className="scripture-card">
          <p className="dashboard-eyebrow">Psalm 46:10</p>
          <blockquote>
            “Be still, and know that I am God.”
          </blockquote>
        </article>

        <section className="devotion-reading">
          <p>
            Stillness is not the absence of responsibility. It is the decision to stop
            letting noise become the loudest voice in your life.
          </p>
          <p>
            God does not ask you to understand everything before trusting Him. Today,
            make room to pause, breathe, and remember who is holding your life.
          </p>
        </section>

        <form className="reflection-form" onSubmit={submitReflection}>
          <label htmlFor="reflection">What is God reminding you of today?</label>
          <p>Your answer remains private unless you choose to share it later.</p>
          <textarea
            id="reflection"
            value={reflection}
            onChange={(event) => setReflection(event.target.value)}
            placeholder="Write one honest takeaway..."
            rows="7"
          />
          {message && <p className="form-message error-message">{message}</p>}

          {completed ? (
            <div className="review-result">
              <span aria-hidden="true">✓</span>
              <div>
                <strong>Meaningful engagement detected</strong>
                <p>
                  Prototype summary: Your reflection focuses on slowing down, trusting
                  God, and making space for His presence.
                </p>
              </div>
            </div>
          ) : (
            <button className="primary-button submit-button" type="submit">
              Complete today’s devotion
            </button>
          )}
        </form>
      </div>
    </main>
  );
}

function App() {
  const [screen, setScreen] = useState('welcome');
  const [reflection, setReflection] = useState('');
  const [completed, setCompleted] = useState(false);

  if (screen === 'welcome') {
    return <Welcome onBegin={() => setScreen('dashboard')} />;
  }

  if (screen === 'devotion') {
    return (
      <Devotion
        reflection={reflection}
        setReflection={setReflection}
        completed={completed}
        onComplete={() => setCompleted(true)}
        onBack={() => setScreen('dashboard')}
      />
    );
  }

  return (
    <Dashboard
      completed={completed}
      onStartDevotion={() => setScreen('devotion')}
      onExit={() => setScreen('welcome')}
    />
  );
}

export default App;
