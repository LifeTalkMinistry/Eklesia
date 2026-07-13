import { useEffect, useState } from 'react';
import Dashboard from './components/Dashboard.jsx';
import Devotion from './components/Devotion.jsx';
import DevotionChoice from './components/DevotionChoice.jsx';
import { getDailyVerseForDate, getManilaDateKey } from './lib/dailyVerse.js';
import {
  createDevotionHistoryRecord,
  loadDevotionHistory,
  saveDevotionHistory,
} from './lib/devotionHistory.js';

function Welcome({ onBegin }) {
  return <main className="app-shell welcome-shell"><section className="welcome-card"><p className="eyebrow">A healthier way to grow together</p><h1>Eklesia</h1><p className="tagline">Track the habit. Protect the heart.</p><p className="description">Build a consistent devotional life while keeping personal reflections private and helping church leaders know when encouragement may be needed.</p><button className="primary-button" type="button" onClick={onBegin}>Begin your journey</button></section></main>;
}

function createEmptyWgap() {
  return {
    getsKo: '',
    application: '',
    prayer: '',
  };
}

function createPersonalDevotion(selection) {
  const startVerse = selection.startVerse ?? selection.verse;
  const endVerse = selection.endVerse ?? startVerse;
  const verseLabel = startVerse === endVerse ? `${startVerse}` : `${startVerse}–${endVerse}`;
  const previewText = selection.firstVerseText || selection.text;

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
    text: previewText,
    previewText,
    fullText: selection.text,
    title: 'My Scripture Reflection',
    devotionType: 'personal',
  };
}

export default function App() {
  const [screen, setScreen] = useState('welcome');
  const [activeTab, setActiveTab] = useState('home');
  const [wgap, setWgap] = useState(createEmptyWgap);
  const [activeDevotion, setActiveDevotion] = useState(null);
  const [activeSavedEntryId, setActiveSavedEntryId] = useState(null);
  const [devotionHistory, setDevotionHistory] = useState(loadDevotionHistory);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [dailyVerse, setDailyVerse] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState('');
  const [bibleTarget, setBibleTarget] = useState(null);
  const [returnFromBible, setReturnFromBible] = useState(false);
  const [bibleSelectionMode, setBibleSelectionMode] = useState(false);

  const todayRecord = devotionHistory.find((entry) => entry.dateKey === getManilaDateKey()) || null;
  const completedToday = Boolean(todayRecord);
  const activeEntryCompleted = Boolean(activeSavedEntryId);

  useEffect(() => {
    saveDevotionHistory(devotionHistory);
  }, [devotionHistory]);

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
    setWgap(createEmptyWgap());
    setActiveDevotion(dailyVerse);
    setActiveSavedEntryId(null);
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
    setWgap(createEmptyWgap());
    setActiveDevotion(createPersonalDevotion(selection));
    setActiveSavedEntryId(null);
    setBibleSelectionMode(false);
    setReturnFromBible(false);
    setScreen('devotion');
  }

  function openDevotionChoice() {
    if (todayRecord) {
      setActiveDevotion(todayRecord.devotion);
      setWgap(todayRecord.wgap);
      setActiveSavedEntryId(todayRecord.id);
      setScreen('devotion');
      return;
    }
    setScreen('devotion-choice');
  }

  function completeDevotion() {
    if (!activeDevotion) return;
    const record = createDevotionHistoryRecord(activeDevotion, wgap);

    setDevotionHistory((current) => [
      record,
      ...current.filter((entry) => entry.id !== record.id),
    ].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()));
    setActiveSavedEntryId(record.id);
    setSelectedHistoryId(record.id);
  }

  function viewSavedDevotion() {
    const entryId = activeSavedEntryId || todayRecord?.id;
    if (!entryId) return;
    setSelectedHistoryId(entryId);
    setActiveTab('journey');
    setScreen('dashboard');
  }

  function returnHome() {
    setSelectedHistoryId(null);
    setActiveTab('home');
    setScreen('dashboard');
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
        wgap={wgap}
        setWgap={setWgap}
        completed={activeEntryCompleted}
        onComplete={completeDevotion}
        onViewSaved={viewSavedDevotion}
        onReturnHome={returnHome}
        onBack={returnHome}
        onReadChapter={() => {
          if (!activeDevotion) return;
          const startVerse = activeDevotion.startVerse ?? activeDevotion.verse;
          const endVerse = activeDevotion.endVerse ?? startVerse;
          const isPersonalPassage = activeDevotion.devotionType === 'personal' && endVerse > startVerse;
          setBibleTarget({
            bookSlug: activeDevotion.bookSlug,
            chapter: activeDevotion.chapter,
            verse: startVerse,
            endVerse,
            label: isPersonalPassage ? 'Selected passage' : activeDevotion.devotionType === 'personal' ? 'Selected verse' : 'Today’s verse',
          });
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
        if (tab !== 'journey') setSelectedHistoryId(null);
        if (tab !== 'bible') {
          setReturnFromBible(false);
          setBibleSelectionMode(false);
        }
      }}
      completed={completedToday}
      onStartDevotion={openDevotionChoice}
      onExit={() => {
        setScreen('welcome');
        setActiveTab('home');
        setSelectedHistoryId(null);
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
      devotionHistory={devotionHistory}
      selectedHistoryId={selectedHistoryId}
      onSelectHistoryEntry={setSelectedHistoryId}
      onCloseHistoryEntry={() => setSelectedHistoryId(null)}
    />
  );
}
