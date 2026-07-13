import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Devotion from './components/Devotion.jsx';
import DevotionChoice from './components/DevotionChoice.jsx';
import { getDailyVerseForDate, getManilaDateKey } from './lib/dailyVerse.js';

function Welcome({ onBegin }) {
  return <main className="app-shell welcome-shell"><section className="welcome-card"><p className="eyebrow">A healthier way to grow together</p><h1>Eklesia</h1><p className="tagline">Track the habit. Protect the heart.</p><p className="description">Build a consistent devotional life while keeping personal reflections private and helping church leaders know when encouragement may be needed.</p><button className="primary-button" type="button" onClick={onBegin}>Begin your journey</button></section></main>;
}

function createPersonalDevotion(selection) {
  const startVerse = selection.startVerse ?? selection.verse;
  const endVerse = selection.endVerse ?? startVerse;
  const verseLabel = startVerse === endVerse ? `${startVerse}` : `${startVerse}–${endVerse}`;

  return {
    id: `PERSONAL-${selection.bookId}-${selection.chapter}-${startVerse}-${endVerse}`,
    bookId: selection.bookId,
    bookSlug: selection.bookSlug,
    bookName: selection.bookName,
    chapter: selection.chapter,
    verse: startVerse,
    startVerse,
    endVerse,
    reference: `${selection.bookName} ${selection.chapter}:${verseLabel}`,
    text: selection.text,
    title: 'My Scripture Reflection',
    theme: 'Personal Scripture reflection',
    prompt: 'What is God showing you through this passage today?',
    devotionType: 'personal',
  };
}

export default function App() {
  const [screen, setScreen] = useState('welcome');
  const [activeTab, setActiveTab] = useState('home');
  const [reflection, setReflection] = useState('');
  const [completed, setCompleted] = useState(false);
  const [completedDevotion, setCompletedDevotion] = useState(null);
  const [activeDevotion, setActiveDevotion] = useState(null);
  const [dailyVerse, setDailyVerse] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState('');
  const [bibleTarget, setBibleTarget] = useState(null);
  const [returnFromBible, setReturnFromBible] = useState(false);
  const [bibleSelectionMode, setBibleSelectionMode] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDailyLoading(true);
    setDailyError('');
    getDailyVerseForDate(getManilaDateKey())
      .then((verse) => { if (!cancelled) setDailyVerse({ ...verse, devotionType: 'suggested' }); })
      .catch((error) => {
        console.error('Daily verse load failed', error);
        if (!cancelled) setDailyError('Today’s Scripture could not be loaded.');
      })
      .finally(() => { if (!cancelled) setDailyLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function openSuggestedDevotion() {
    if (!dailyVerse) return;
    setReflection('');
    setActiveDevotion(dailyVerse);
    setBibleSelectionMode(false);
    setScreen('devotion');
  }

  function openPersonalVersePicker() {
    setBibleTarget(null);
    setReturnFromBible(false);
    setBibleSelectionMode(true);
    setActiveTab('bible');
    setScreen('dashboard');
  }

  function openPersonalDevotion(selection) {
    setReflection('');
    setActiveDevotion(createPersonalDevotion(selection));
    setBibleSelectionMode(false);
    setReturnFromBible(false);
    setScreen('devotion');
  }

  function openDevotionChoice() {
    if (completed && completedDevotion) {
      setActiveDevotion(completedDevotion);
      setScreen('devotion');
      return;
    }
    setScreen('devotion-choice');
  }

  if (screen === 'welcome') return <Welcome onBegin={() => setScreen('dashboard')} />;

  if (screen === 'devotion-choice') {
    return (
      <DevotionChoice
        dailyVerse={dailyVerse}
        loading={dailyLoading}
        error={dailyError}
        onBack={() => { setScreen('dashboard'); setActiveTab('home'); }}
        onUseSuggested={openSuggestedDevotion}
        onChooseVerse={openPersonalVersePicker}
      />
    );
  }

  if (screen === 'devotion') {
    return (
      <Devotion
        devotion={activeDevotion}
        reflection={reflection}
        setReflection={setReflection}
        completed={completed}
        onComplete={() => {
          setCompleted(true);
          setCompletedDevotion(activeDevotion);
        }}
        onBack={() => { setScreen('dashboard'); setActiveTab('home'); }}
        onReadChapter={() => {
          if (!activeDevotion) return;
          setBibleTarget({ bookSlug: activeDevotion.bookSlug, chapter: activeDevotion.chapter, verse: activeDevotion.verse });
          setBibleSelectionMode(false);
          setReturnFromBible(true);
          setActiveTab('bible');
          setScreen('dashboard');
        }}
      />
    );
  }

  return (
    <Dashboard
      activeTab={activeTab}
      setActiveTab={(tab) => {
        setActiveTab(tab);
        if (tab !== 'bible') {
          setReturnFromBible(false);
          setBibleSelectionMode(false);
        }
      }}
      completed={completed}
      onStartDevotion={openDevotionChoice}
      onExit={() => {
        setScreen('welcome');
        setActiveTab('home');
        setBibleSelectionMode(false);
        setReturnFromBible(false);
      }}
      dailyVerse={dailyVerse}
      dailyLoading={dailyLoading}
      dailyError={dailyError}
      bibleTarget={bibleTarget}
      bibleSelectionMode={bibleSelectionMode}
      onSelectBibleVerse={openPersonalDevotion}
      onCancelBibleSelection={() => {
        setBibleSelectionMode(false);
        setActiveTab('home');
        setScreen('devotion-choice');
      }}
      onReturnFromBible={returnFromBible ? () => {
        setReturnFromBible(false);
        setScreen('devotion');
      } : null}
    />
  );
}
