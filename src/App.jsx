import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Devotion from './components/Devotion.jsx';
import { getDailyVerseForDate, getManilaDateKey } from './lib/dailyVerse.js';

function Welcome({ onBegin }) {
  return <main className="app-shell welcome-shell"><section className="welcome-card"><p className="eyebrow">A healthier way to grow together</p><h1>Eklesia</h1><p className="tagline">Track the habit. Protect the heart.</p><p className="description">Build a consistent devotional life while keeping personal reflections private and helping church leaders know when encouragement may be needed.</p><button className="primary-button" type="button" onClick={onBegin}>Begin your journey</button></section></main>;
}

export default function App() {
  const [screen, setScreen] = useState('welcome');
  const [activeTab, setActiveTab] = useState('home');
  const [reflection, setReflection] = useState('');
  const [completed, setCompleted] = useState(false);
  const [dailyVerse, setDailyVerse] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState('');
  const [bibleTarget, setBibleTarget] = useState(null);
  const [returnFromBible, setReturnFromBible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDailyLoading(true);
    getDailyVerseForDate(getManilaDateKey())
      .then((verse) => { if (!cancelled) setDailyVerse(verse); })
      .catch((error) => {
        console.error('Daily verse load failed', error);
        if (!cancelled) setDailyError('Today’s Scripture could not be loaded.');
      })
      .finally(() => { if (!cancelled) setDailyLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (screen === 'welcome') return <Welcome onBegin={() => setScreen('dashboard')} />;

  if (screen === 'devotion') {
    return <Devotion dailyVerse={dailyVerse} reflection={reflection} setReflection={setReflection} completed={completed} onComplete={() => setCompleted(true)} onBack={() => { setScreen('dashboard'); setActiveTab('home'); }} onReadChapter={() => { if (!dailyVerse) return; setBibleTarget({ bookSlug: dailyVerse.bookSlug, chapter: dailyVerse.chapter, verse: dailyVerse.verse }); setReturnFromBible(true); setActiveTab('bible'); setScreen('dashboard'); }} />;
  }

  return <Dashboard activeTab={activeTab} setActiveTab={(tab) => { setActiveTab(tab); if (tab !== 'bible') setReturnFromBible(false); }} completed={completed} onStartDevotion={() => dailyVerse && setScreen('devotion')} onExit={() => setScreen('welcome')} dailyVerse={dailyVerse} dailyLoading={dailyLoading} dailyError={dailyError} bibleTarget={bibleTarget} onReturnFromBible={returnFromBible ? () => { setReturnFromBible(false); setScreen('devotion'); } : null} />;
}
