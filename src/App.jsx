import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_NAME, APP_TAGLINE } from './config/appConfig.js';
import AdditionalDevotionChooser from './components/AdditionalDevotionChooser.jsx';
import AlphaInformation from './components/AlphaInformation.jsx';
import Dashboard from './components/Dashboard.jsx';
import Devotion from './components/Devotion.jsx';
import DevotionChoice from './components/DevotionChoice.jsx';
import PersonalSetup from './components/PersonalSetup.jsx';
import NotebookDevotionFlow from './components/NotebookDevotionFlow.jsx';
import { getAdditionalVerseForSession, getDailyVerseForDate } from './lib/dailyVerse.js';
import { getManilaDateKey } from './lib/manilaTime.js';
import {
  getAllDevotions,
  getLastBibleLocation,
  getOfficialDailyDevotion,
  getRecentlyCompletedReferences,
  saveCompletedDevotion,
} from './services/devotionService.js';
import {
  acceptAlphaNotice,
  getLocalProfile,
  hasAcceptedAlphaNotice,
  hasCompletedOnboarding,
  saveLocalProfile,
  setOnboardingComplete,
} from './services/profileService.js';
import { isLocalStorageAvailable } from './services/storageRegistry.js';
import {
  deleteAllEkklesiaPulseLocalData,
  restartIntroductionState,
} from './services/testerToolsService.js';

function StorageWarning() {
  return (
    <p className="alpha-global-warning" role="status">
      This browser is currently preventing Ekklesia Pulse from saving information. You may explore the app, but your progress may not remain after closing it.
    </p>
  );
}

function Welcome({ onBegin, statusMessage, storageAvailable }) {
  return (
    <main className="app-shell welcome-shell">
      <section className="welcome-card">
        <p className="eyebrow">A healthier way to grow together</p>
        <h1>{APP_NAME}</h1>
        <p className="tagline">{APP_TAGLINE}</p>
        <p className="description">Build a consistent devotional life, reflect on Scripture through WGAP, and stay connected to a church community that knows when encouragement may be needed.</p>
        {!storageAvailable ? <StorageWarning /> : null}
        {statusMessage ? <p className="alpha-success-message" role="status">{statusMessage}</p> : null}
        <button className="primary-button" type="button" onClick={onBegin}>Begin your journey</button>
      </section>
    </main>
  );
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

function safelyGetAllDevotions() {
  try {
    return getAllDevotions();
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore local devotion history.', error);
    return [];
  }
}

function safelyGetLastBibleLocation() {
  try {
    return getLastBibleLocation();
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore the Bible reading position.', error);
    return null;
  }
}

function loadInitialProfile() {
  const result = getLocalProfile();
  return result.ok ? result.data : null;
}

export default function App() {
  const [screen, setScreen] = useState('welcome');
  const [activeTab, setActiveTab] = useState('home');
  const [profile, setProfile] = useState(loadInitialProfile);
  const [storageAvailable, setStorageAvailable] = useState(isLocalStorageAvailable);
  const [appMessage, setAppMessage] = useState('');
  const [sessionKey, setSessionKey] = useState(0);
  const [wgap, setWgap] = useState(createEmptyWgap);
  const [activeDevotion, setActiveDevotion] = useState(null);
  const [activeSavedEntryId, setActiveSavedEntryId] = useState(null);
  const [completionType, setCompletionType] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [devotions, setDevotions] = useState(safelyGetAllDevotions);
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
  const [bibleSelectionOrigin, setBibleSelectionOrigin] = useState('additional');
  const [additionalChooserOpen, setAdditionalChooserOpen] = useState(false);
  const [additionalSuggestion, setAdditionalSuggestion] = useState(null);
  const [additionalSuggestionLoading, setAdditionalSuggestionLoading] = useState(false);
  const [additionalSuggestionError, setAdditionalSuggestionError] = useState('');
  const [lastBibleLocation, setLastBibleLocation] = useState(safelyGetLastBibleLocation);
  const [notebookInitialFile, setNotebookInitialFile] = useState(null);

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

  function beginJourney() {
    setAppMessage('');
    const storedProfile = getLocalProfile();
    const nextProfile = storedProfile.ok ? storedProfile.data : profile;
    setProfile(nextProfile);
    setStorageAvailable(isLocalStorageAvailable());

    if (nextProfile && hasCompletedOnboarding() && hasAcceptedAlphaNotice()) {
      setScreen('dashboard');
      return;
    }

    setScreen('personal-setup');
  }

  function completePersonalSetup(values) {
    const result = saveLocalProfile(values);
    if (!result.ok) return result;
    setProfile(result.data);
    setStorageAvailable(result.persisted !== false && isLocalStorageAvailable());
    setScreen('alpha-information');
    return result;
  }

  function acceptAlphaInformation() {
    const acceptance = acceptAlphaNotice();
    const onboarding = setOnboardingComplete();
    const currentProfile = getLocalProfile();
    if (currentProfile.ok) setProfile(currentProfile.data);
    const persisted = acceptance.persisted !== false && onboarding.persisted !== false;
    setStorageAvailable(persisted && isLocalStorageAvailable());
    setAppMessage(persisted ? '' : 'Your alpha acknowledgement is available only during this session.');
    setScreen('dashboard');
  }

  function restartIntroduction() {
    const result = restartIntroductionState();
    if (!result.ok) return result;

    setActiveTab('home');
    setSelectedHistoryId(null);
    setBibleSelectionMode(false);
    setReturnFromBible(false);
    setAdditionalChooserOpen(false);
    setAppMessage('');
    setScreen('welcome');
    return result;
  }

  async function deleteLocalData() {
    const result = await deleteAllEkklesiaPulseLocalData();
    if (!result.localDataRemoved) return result;

    setProfile(null);
    setDevotions([]);
    setWgap(createEmptyWgap());
    setActiveDevotion(null);
    setActiveSavedEntryId(null);
    setCompletionType(null);
    setSelectedHistoryId(null);
    setLastBibleLocation(null);
    setNotebookInitialFile(null);
    setBibleTarget(null);
    setBibleSelectionMode(false);
    setReturnFromBible(false);
    setAdditionalChooserOpen(false);
    setAdditionalSuggestion(null);
    setActiveTab('home');
    setSessionKey((current) => current + 1);
    setStorageAvailable(isLocalStorageAvailable());
    setAppMessage(result.message);
    setScreen('welcome');
    return result;
  }

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
    setLastBibleLocation(safelyGetLastBibleLocation());
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

  function openDailyDevotionChoice() {
    if (completedToday) return;
    setScreen('devotion-choice');
  }

  function openOfficialDevotion() {
    if (!dailyVerse || completedToday) return;
    beginDevotion({ ...dailyVerse, source: 'daily-suggestion', flowType: 'daily' });
  }

  function openNotebookCapture(file) {
    if (!file) return;
    setAdditionalChooserOpen(false);
    setNotebookInitialFile(file);
    setScreen('notebook-capture');
  }

  function handleNotebookSaved(result) {
    const refreshed = safelyGetAllDevotions();
    setDevotions(refreshed);
    setSelectedHistoryId(result.entry.id);
    setStorageAvailable(isLocalStorageAvailable());
  }

  function openNotebookJourney(entryId) {
    if (!entryId) return;
    setSelectedHistoryId(entryId);
    setActiveTab('journey');
    setNotebookInitialFile(null);
    setScreen('dashboard');
  }

  function refreshDevotionHistory(updatedEntry) {
    const refreshed = safelyGetAllDevotions();
    setDevotions(refreshed);
    if (updatedEntry?.id) setSelectedHistoryId(updatedEntry.id);
  }

  function reviewTodayDevotion() {
    if (!todayOfficial) return;
    if (todayOfficial.devotionFormat === 'notebook') {
      setSelectedHistoryId(todayOfficial.id);
      setActiveTab('journey');
      setScreen('dashboard');
      return;
    }
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
    setBibleSelectionOrigin('additional');
    setBibleTarget(target);
    setReturnFromBible(false);
    setBibleSelectionMode(true);
    setAdditionalChooserOpen(false);
    setActiveTab('bible');
    setScreen('dashboard');
  }

  function openBibleForDaily() {
    setBibleSelectionSource('bible-selection');
    setBibleSelectionOrigin('daily');
    setBibleTarget(null);
    setReturnFromBible(false);
    setBibleSelectionMode(true);
    setAdditionalChooserOpen(false);
    setActiveTab('bible');
    setScreen('dashboard');
  }

  function continueReading() {
    const location = safelyGetLastBibleLocation();
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
    const personalDevotion = createPersonalDevotion(selection, bibleSelectionSource);
    beginDevotion({
      ...personalDevotion,
      flowType: bibleSelectionOrigin === 'daily' ? 'daily' : 'additional',
    });
  }

  function completeDevotion() {
    if (!activeDevotion || isSaving || activeSavedEntryId) return;
    setIsSaving(true);
    try {
      const result = saveCompletedDevotion(activeDevotion, wgap, { submissionKey: submissionKeyRef.current });
      const refreshed = safelyGetAllDevotions();
      setDevotions(refreshed);
      setActiveSavedEntryId(result.entry.id);
      setSelectedHistoryId(result.entry.id);
      setCompletionType(result.type);
      setActiveDevotion(entryToDevotion(result.entry));
      setWgap(result.entry.wgap);
      setStorageAvailable(isLocalStorageAvailable());
    } catch (error) {
      console.error('Devotion save failed', error);
      setStorageAvailable(false);
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

  if (screen === 'welcome') {
    return <Welcome onBegin={beginJourney} statusMessage={appMessage} storageAvailable={storageAvailable} />;
  }

  if (screen === 'personal-setup') {
    return (
      <PersonalSetup
        profile={profile}
        storageAvailable={storageAvailable}
        onContinue={completePersonalSetup}
        onBack={() => setScreen('welcome')}
      />
    );
  }

  if (screen === 'alpha-information') {
    return (
      <AlphaInformation
        storageAvailable={storageAvailable}
        onContinue={acceptAlphaInformation}
      />
    );
  }

  if (screen === 'devotion-choice') {
    return (
      <DevotionChoice
        dailyVerse={dailyVerse}
        loading={dailyLoading}
        error={dailyError}
        onBack={returnHome}
        onUseSuggested={openOfficialDevotion}
        onChooseVerse={openBibleForDaily}
        onCaptureNotebook={openNotebookCapture}
      />
    );
  }

  if (screen === 'notebook-capture') {
    return (
      <NotebookDevotionFlow
        initialFile={notebookInitialFile}
        onCancel={() => {
          setNotebookInitialFile(null);
          setScreen(completedToday ? 'dashboard' : 'devotion-choice');
        }}
        onSaved={handleNotebookSaved}
        onReturnHome={() => {
          setNotebookInitialFile(null);
          returnHome();
        }}
        onViewJourney={openNotebookJourney}
      />
    );
  }

  if (screen === 'devotion') {
    return (
      <>
        {!storageAvailable ? <StorageWarning /> : null}
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
      </>
    );
  }

  return (
    <>
      <Dashboard
        key={sessionKey}
        profile={profile}
        storageAvailable={storageAvailable}
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
        onStartDaily={openDailyDevotionChoice}
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
        onProfileUpdated={(nextProfile, result) => {
          setProfile(nextProfile);
          setStorageAvailable(result?.persisted !== false && isLocalStorageAvailable());
        }}
        onRestartIntroduction={restartIntroduction}
        onDeleteLocalData={deleteLocalData}
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
          setLastBibleLocation(safelyGetLastBibleLocation());

          if (bibleSelectionOrigin === 'daily') {
            setScreen('devotion-choice');
            return;
          }

          setScreen('dashboard');
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
        onHistoryEntryUpdated={refreshDevotionHistory}
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
        onCaptureNotebook={openNotebookCapture}
        onClose={closeAdditionalChooser}
        triggerRef={additionalTriggerRef}
      />
    </>
  );
}
