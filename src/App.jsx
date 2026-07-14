import { useCallback, useEffect, useRef, useState } from 'react';
import AdditionalDevotionChooser from './components/AdditionalDevotionChooser.jsx';
import Dashboard from './components/Dashboard.jsx';
import Devotion from './components/Devotion.jsx';
import { getAdditionalVerseForSession, getDailyVerseForDate } from './lib/dailyVerse.js';
import { getManilaDateKey } from './lib/manilaTime.js';
import {
  getAllDevotions,
  getLastBibleLocation,
  getOfficialDailyDevotion,
  getRecentlyCompletedReferences,
  saveCompletedDevotion,
} from './services/devotionService.js';

function Welcome({ onBegin }) {
  return <main className="app-shell welcome-shell"><section className="welcome-card"><p className="eyebrow">A healthier way to grow together</p><h1>Ekklesia Pulse</h1><p className="tagline">Build your rhythm. Strengthen the church.</p><p className="description">Build a consistent devotional life, reflect on Scripture through WGAP, and stay connected to a church community that knows when encouragement may be needed.</p><button className="primary-button" type="button" onClick={onBegin}>Begin your journey</button></section></main>;
}

function createEmptyWgap() {
  return { word: '', gratitude: '', application: '', prayer: '' };
}

function createPersonalDevotion(selection, source = 'bible-selection') {
  const startVerse = selection.startVerse ?? selection.verse;
  const endVerse = selection.endVerse ?? startVerse;
  const verseLabel = startVerse === endVerse ? `${startVerse}` : `${startVerse}–${endVerse}`;
  return {
    bookId: selection.bookId,
    bookSlug: selection.bookSlug,
    bookName: selection.bookName,
    chapter: selection.chapter,
    verse: startVerse,
    verseStart: startVerse,
    verseEnd: endVerse,
    reference: `${selection.bookName} ${selection.chapter}:${verseLabel}`,
    text: selection.text,
    scriptureText: selection.text,
    title: 'Personal Scripture reflection',
    theme: 'Selected from the Bible',
    prompt: 'What is God showing you through this passage?',
    source,
    flowType: 'additional',
  };
}

function entryToDevotion(entry) {
  if (!entry) return null;
  return {
    bookId: entry.bookId,
    bookSlug: entry.bookSlug,
    bookName: entry.bookName,
    chapter: entry.chapter,
    verse: entry.verseStart,
    verseStart: entry.verseStart,
    verseEnd: entry.verseEnd,
    reference: entry.reference,
    text: entry.scriptureText,
    scriptureText: entry.scriptureText,
    title: entry.title,
    theme: entry.theme,
    prompt: entry.prompt,
    source: entry.source,
    flowType: entry.type,
  };
}

export default function App() {
  const [screen, setScreen] = useState('welcome');
  const [activeTab, setActiveTab] = useState('home');
  const [wgap, setWgap] = useState(createEmptyWgap);
  const [activeDevotion, setActiveDevotion] = useState(null);
  const [activeSavedEntryId, setActiveSavedEntryId] = useState(null);
  const [completionType, setCompletionType] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [devotions, setDevotions] = useState(getAllDevotions);
  const [selectedHistoryId, setSelectedHistoryId] = useState(null);
  const [manilaDateKey, setManilaDateKey] = useState(getManilaDateKey);
  const [dailyVerse, setDailyVerse] = useState(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [dailyError, setDailyError] = useState('');
  const [dailyRefreshing, setDailyRefreshing] = useState(false);
  const [dailyRefreshError, setDailyRefreshError] = useState('');
  const [bibleTarget, setBibleTarget] = useState(null);
  const [returnFromBible, setReturnFromBible] = useState(false);
  const [bibleSelectionMode, setBibleSelectionMode] = useState(false);
  const [bibleSelectionSource, setBibleSelectionSource] = useState('bible-selection');
  const [additionalChooserOpen, setAdditionalChooserOpen] = useState(false);
  const [additionalSuggestion, setAdditionalSuggestion] = useState(null);
  const [additionalSuggestionLoading, setAdditionalSuggestionLoading] = useState(false);
  const [additionalSuggestionError, setAdditionalSuggestionError] = useState('');
  const [lastBibleLocation, setLastBibleLocation] = useState(getLastBibleLocation);

  const submissionKeyRef = useRef('');
  const additionalTriggerRef = useRef(null);
  const suggestionIndexRef = useRef(0);
  const suggestionRequestRef = useRef(0);
  const dailyBaseReferenceRef = useRef('');
  const dailySuggestionIndexRef = useRef(-1);
  const dailySuggestionRequestRef = useRef(0);

  const todayOfficial = getOfficialDailyDevotion(manilaDateKey, devotions);
  const completedToday = Boolean(todayOfficial);
  const activeEntryCompleted = Boolean(activeSavedEntryId);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const nextKey = getManilaDateKey();
      setManilaDateKey((current) => (current === nextKey ? current : nextKey));
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    dailySuggestionRequestRef.current += 1;
    dailySuggestionIndexRef.current = -1;
    dailyBaseReferenceRef.current = '';
    setDailyLoading(true);
    setDailyError('');
    setDailyRefreshing(false);
    setDailyRefreshError('');
    getDailyVerseForDate(manilaDateKey)
      .then((verse) => {
        if (!cancelled) {
          dailyBaseReferenceRef.current = verse.reference;
          setDailyVerse({ ...verse, flowType: 'daily' });
        }
      })
      .catch((error) => {
        console.error('Daily verse load failed', error);
        if (!cancelled) {
          setDailyVerse(null);
          setDailyError('Today’s Scripture could not be loaded.');
        }
      })
      .finally(() => { if (!cancelled) setDailyLoading(false); });
    return () => { cancelled = true; };
  }, [manilaDateKey]);

  useEffect(() => {
    setAdditionalChooserOpen(false);
    setAdditionalSuggestion(null);
  }, [manilaDateKey]);

  const closeAdditionalChooser = useCallback(() => {
    setAdditionalChooserOpen(false);
  }, []);

  async function refreshDailySuggestion() {
    if (completedToday || dailyLoading || dailyRefreshing) return;

    const nextIndex = dailySuggestionIndexRef.current + 1;
    const requestId = dailySuggestionRequestRef.current + 1;
    dailySuggestionRequestRef.current = requestId;
    setDailyRefreshing(true);
    setDailyRefreshError('');

    try {
      const suggestion = await getAdditionalVerseForSession({
        dateKey: manilaDateKey,
        officialReference: dailyBaseReferenceRef.current || dailyVerse?.reference || '',
        recentReferences: getRecentlyCompletedReferences(30, new Date(), devotions),
        sessionSeed: String(nextIndex),
      });

      if (dailySuggestionRequestRef.current !== requestId) return;
      if (!suggestion) {
        setDailyRefreshError('Another curated suggestion is not available right now.');
        return;
      }

      dailySuggestionIndexRef.current = nextIndex;
      setDailyVerse({ ...suggestion, source: 'daily-suggestion', flowType: 'daily' });
    } catch (error) {
      console.error('Daily suggestion refresh failed', error);
      if (dailySuggestionRequestRef.current === requestId) {
        setDailyRefreshError('Another suggestion could not be loaded. Please try again.');
      }
    } finally {
      if (dailySuggestionRequestRef.current === requestId) setDailyRefreshing(false);
    }
  }

  async function prepareAdditionalSuggestion(index) {
    const requestId = suggestionRequestRef.current + 1;
    suggestionRequestRef.current = requestId;
    setAdditionalSuggestionLoading(true);
    setAdditionalSuggestionError('');
    try {
      const suggestion = await getAdditionalVerseForSession({
        dateKey: manilaDateKey,
        officialReference: todayOfficial?.reference || dailyVerse?.reference || '',
        recentReferences: getRecentlyCompletedReferences(30, new Date(), devotions),
        sessionSeed: String(index),
      });
      if (suggestionRequestRef.current !== requestId) return;
      if (!suggestion) {
        setAdditionalSuggestion(null);
        setAdditionalSuggestionError('No curated suggestion is available right now. You may choose a passage from the Bible instead.');
        return;
      }
      setAdditionalSuggestion({ ...suggestion, flowType: 'additional' });
    } catch (error) {
      console.error('Additional verse load failed', error);
      if (suggestionRequestRef.current === requestId) {
        setAdditionalSuggestion(null);
        setAdditionalSuggestionError('This Scripture suggestion could not be loaded. Please choose from the Bible or try another suggestion.');
      }
    } finally {
      if (suggestionRequestRef.current === requestId) setAdditionalSuggestionLoading(false);
    }
  }

  function openAdditionalChooser(event) {
    if (event?.currentTarget) additionalTriggerRef.current = event.currentTarget;
    setLastBibleLocation(getLastBibleLocation());
    setAdditionalChooserOpen(true);
    if (!additionalSuggestion) {
      suggestionIndexRef.current = 0;
      prepareAdditionalSuggestion(0);
    }
  }

  function showAnotherSuggestion() {
    suggestionIndexRef.current += 1;
    prepareAdditionalSuggestion(suggestionIndexRef.current);
  }

  function beginDevotion(devotion) {
    setWgap(createEmptyWgap());
    setActiveDevotion(devotion);
    setActiveSavedEntryId(null);
    setCompletionType(null);
    setIsSaving(false);
    submissionKeyRef.current = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${devotion.reference}`;
    setBibleSelectionMode(false);
    setReturnFromBible(false);
    setAdditionalChooserOpen(false);
    setScreen('devotion');
  }

  function openOfficialDevotion() {
    if (!dailyVerse || completedToday) return;
    beginDevotion({ ...dailyVerse, source: 'daily-suggestion', flowType: 'daily' });
  }

  function reviewTodayDevotion() {
    if (!todayOfficial) return;
    setActiveDevotion(entryToDevotion(todayOfficial));
    setWgap(todayOfficial.wgap || createEmptyWgap());
    setActiveSavedEntryId(todayOfficial.id);
    setCompletionType('daily');
    setScreen('devotion');
  }

  function useAdditionalSuggestion() {
    if (!additionalSuggestion) return;
    beginDevotion({ ...additionalSuggestion, source: 'additional-suggestion', flowType: 'additional' });
  }

  function openBibleForAdditional(source = 'bible-selection', target = null) {
    setBibleSelectionSource(source);
    setBibleTarget(target);
    setReturnFromBible(false);
    setBibleSelectionMode(true);
    setAdditionalChooserOpen(false);
    setActiveTab('bible');
    setScreen('dashboard');
  }

  function continueReading() {
    const location = getLastBibleLocation();
    setLastBibleLocation(location);
    if (!location) {
      openBibleForAdditional('bible-selection', null);
      return;
    }
    openBibleForAdditional('continue-reading', {
      ...location,
      label: 'Continue reading',
    });
  }

  function openPersonalDevotion(selection) {
    beginDevotion(createPersonalDevotion(selection, bibleSelectionSource));
  }

  function completeDevotion() {
    if (!activeDevotion || isSaving || activeSavedEntryId) return;
    setIsSaving(true);
    try {
      const result = saveCompletedDevotion(activeDevotion, wgap, { submissionKey: submissionKeyRef.current });
      const refreshed = getAllDevotions();
      setDevotions(refreshed);
      setActiveSavedEntryId(result.entry.id);
      setSelectedHistoryId(result.entry.id);
      setCompletionType(result.type);
      setActiveDevotion(entryToDevotion(result.entry));
      setWgap(result.entry.wgap);
    } catch (error) {
      console.error('Devotion save failed', error);
    } finally {
      setIsSaving(false);
    }
  }

  function viewSavedDevotion() {
    const entryId = activeSavedEntryId || todayOfficial?.id;
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

  function spendMoreFromDevotion(event) {
    if (event?.currentTarget) additionalTriggerRef.current = event.currentTarget;
    returnHome();
    window.requestAnimationFrame(() => openAdditionalChooser());
  }

  if (screen === 'welcome') return <Welcome onBegin={() => setScreen('dashboard')} />;

  if (screen === 'devotion') {
    return (
      <Devotion
        devotion={activeDevotion}
        wgap={wgap}
        setWgap={setWgap}
        completed={activeEntryCompleted}
        completionType={completionType}
        isSaving={isSaving}
        onComplete={completeDevotion}
        onViewSaved={viewSavedDevotion}
        onReturnHome={returnHome}
        onSpendMore={spendMoreFromDevotion}
        onBack={returnHome}
        onReadChapter={() => {
          if (!activeDevotion) return;
          const startVerse = activeDevotion.verseStart ?? activeDevotion.startVerse ?? activeDevotion.verse;
          const endVerse = activeDevotion.verseEnd ?? activeDevotion.endVerse ?? startVerse;
          setBibleTarget({
            bookSlug: activeDevotion.bookSlug,
            chapter: activeDevotion.chapter,
            verse: startVerse,
            endVerse,
            label: endVerse > startVerse ? 'Selected passage' : completionType === 'additional' ? 'Additional devotion' : 'Today’s verse',
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
    <>
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
        officialDevotion={todayOfficial}
        onStartDaily={openOfficialDevotion}
        onReviewDaily={reviewTodayDevotion}
        onSpendMore={openAdditionalChooser}
        onExit={() => {
          setScreen('welcome');
          setActiveTab('home');
          setSelectedHistoryId(null);
          setBibleSelectionMode(false);
          setReturnFromBible(false);
          setAdditionalChooserOpen(false);
        }}
        dailyVerse={dailyVerse}
        dailyLoading={dailyLoading}
        dailyError={dailyError}
        dailyRefreshing={dailyRefreshing}
        dailyRefreshError={dailyRefreshError}
        onRefreshDaily={refreshDailySuggestion}
        bibleTarget={bibleTarget}
        bibleSelectionMode={bibleSelectionMode}
        onSelectBibleVerse={openPersonalDevotion}
        onCancelBibleSelection={() => {
          setBibleSelectionMode(false);
          setActiveTab('home');
          setScreen('dashboard');
          setLastBibleLocation(getLastBibleLocation());
          setAdditionalChooserOpen(true);
        }}
        onReturnFromBible={returnFromBible ? () => {
          setReturnFromBible(false);
          setScreen('devotion');
        } : null}
        devotionHistory={devotions}
        selectedHistoryId={selectedHistoryId}
        onSelectHistoryEntry={setSelectedHistoryId}
        onCloseHistoryEntry={() => setSelectedHistoryId(null)}
      />
      <AdditionalDevotionChooser
        open={additionalChooserOpen}
        suggestion={additionalSuggestion}
        suggestionLoading={additionalSuggestionLoading}
        suggestionError={additionalSuggestionError}
        lastLocation={lastBibleLocation}
        onUseSuggestion={useAdditionalSuggestion}
        onShowAnother={showAnotherSuggestion}
        onChooseBible={() => openBibleForAdditional('bible-selection', null)}
        onContinueReading={continueReading}
        onClose={closeAdditionalChooser}
        triggerRef={additionalTriggerRef}
      />
    </>
  );
}
