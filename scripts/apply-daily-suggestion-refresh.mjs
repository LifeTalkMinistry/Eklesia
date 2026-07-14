import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(content, before, after, path) {
  if (!content.includes(before)) {
    throw new Error(`Expected source block was not found in ${path}`);
  }
  return content.replace(before, after);
}

function updateApp() {
  const path = 'src/App.jsx';
  let content = read(path);

  content = replaceOnce(
    content,
    "  const [dailyError, setDailyError] = useState('');\n  const [bibleTarget, setBibleTarget] = useState(null);",
    "  const [dailyError, setDailyError] = useState('');\n  const [dailyRefreshing, setDailyRefreshing] = useState(false);\n  const [dailyRefreshError, setDailyRefreshError] = useState('');\n  const [bibleTarget, setBibleTarget] = useState(null);",
    path,
  );

  content = replaceOnce(
    content,
    "  const suggestionIndexRef = useRef(0);\n  const suggestionRequestRef = useRef(0);",
    "  const suggestionIndexRef = useRef(0);\n  const suggestionRequestRef = useRef(0);\n  const dailyBaseReferenceRef = useRef('');\n  const dailySuggestionIndexRef = useRef(-1);\n  const dailySuggestionRequestRef = useRef(0);",
    path,
  );

  content = replaceOnce(
    content,
    `  useEffect(() => {\n    let cancelled = false;\n    setDailyLoading(true);\n    setDailyError('');\n    getDailyVerseForDate(manilaDateKey)\n      .then((verse) => { if (!cancelled) setDailyVerse({ ...verse, flowType: 'daily' }); })\n      .catch((error) => {\n        console.error('Daily verse load failed', error);\n        if (!cancelled) {\n          setDailyVerse(null);\n          setDailyError('Today’s Scripture could not be loaded.');\n        }\n      })\n      .finally(() => { if (!cancelled) setDailyLoading(false); });\n    return () => { cancelled = true; };\n  }, [manilaDateKey]);`,
    `  useEffect(() => {\n    let cancelled = false;\n    dailySuggestionRequestRef.current += 1;\n    dailySuggestionIndexRef.current = -1;\n    dailyBaseReferenceRef.current = '';\n    setDailyLoading(true);\n    setDailyError('');\n    setDailyRefreshing(false);\n    setDailyRefreshError('');\n    getDailyVerseForDate(manilaDateKey)\n      .then((verse) => {\n        if (!cancelled) {\n          dailyBaseReferenceRef.current = verse.reference;\n          setDailyVerse({ ...verse, flowType: 'daily' });\n        }\n      })\n      .catch((error) => {\n        console.error('Daily verse load failed', error);\n        if (!cancelled) {\n          setDailyVerse(null);\n          setDailyError('Today’s Scripture could not be loaded.');\n        }\n      })\n      .finally(() => { if (!cancelled) setDailyLoading(false); });\n    return () => { cancelled = true; };\n  }, [manilaDateKey]);`,
    path,
  );

  content = replaceOnce(
    content,
    "  async function prepareAdditionalSuggestion(index) {",
    `  async function refreshDailySuggestion() {\n    if (completedToday || dailyLoading || dailyRefreshing) return;\n\n    const nextIndex = dailySuggestionIndexRef.current + 1;\n    const requestId = dailySuggestionRequestRef.current + 1;\n    dailySuggestionRequestRef.current = requestId;\n    setDailyRefreshing(true);\n    setDailyRefreshError('');\n\n    try {\n      const suggestion = await getAdditionalVerseForSession({\n        dateKey: manilaDateKey,\n        officialReference: dailyBaseReferenceRef.current || dailyVerse?.reference || '',\n        recentReferences: getRecentlyCompletedReferences(30, new Date(), devotions),\n        sessionSeed: String(nextIndex),\n      });\n\n      if (dailySuggestionRequestRef.current !== requestId) return;\n      if (!suggestion) {\n        setDailyRefreshError('Another curated suggestion is not available right now.');\n        return;\n      }\n\n      dailySuggestionIndexRef.current = nextIndex;\n      setDailyVerse({ ...suggestion, source: 'daily-suggestion', flowType: 'daily' });\n    } catch (error) {\n      console.error('Daily suggestion refresh failed', error);\n      if (dailySuggestionRequestRef.current === requestId) {\n        setDailyRefreshError('Another suggestion could not be loaded. Please try again.');\n      }\n    } finally {\n      if (dailySuggestionRequestRef.current === requestId) setDailyRefreshing(false);\n    }\n  }\n\n  async function prepareAdditionalSuggestion(index) {`,
    path,
  );

  content = replaceOnce(
    content,
    "        dailyError={dailyError}\n        bibleTarget={bibleTarget}",
    "        dailyError={dailyError}\n        dailyRefreshing={dailyRefreshing}\n        dailyRefreshError={dailyRefreshError}\n        onRefreshDaily={refreshDailySuggestion}\n        bibleTarget={bibleTarget}",
    path,
  );

  write(path, content);
}

function updateDashboard() {
  const path = 'src/components/Dashboard.jsx';
  let content = read(path);

  content = replaceOnce(
    content,
    "  dailyLoading,\n  dailyError,\n  completed,",
    "  dailyLoading,\n  dailyError,\n  dailyRefreshing,\n  dailyRefreshError,\n  completed,",
    path,
  );

  content = replaceOnce(
    content,
    "  onStartDaily,\n  onReviewDaily,",
    "  onStartDaily,\n  onRefreshDaily,\n  onReviewDaily,",
    path,
  );

  content = replaceOnce(
    content,
    "        error={dailyError}\n        onStart={onStartDaily}",
    "        error={dailyError}\n        refreshing={dailyRefreshing}\n        refreshError={dailyRefreshError}\n        onRefresh={onRefreshDaily}\n        onStart={onStartDaily}",
    path,
  );

  content = replaceOnce(
    content,
    "  dailyLoading,\n  dailyError,\n  bibleTarget,",
    "  dailyLoading,\n  dailyError,\n  dailyRefreshing,\n  dailyRefreshError,\n  onRefreshDaily,\n  bibleTarget,",
    path,
  );

  content = replaceOnce(
    content,
    "    home: <HomeDashboard dailyVerse={dailyVerse} dailyLoading={dailyLoading} dailyError={dailyError} completed={completed} officialDevotion={officialDevotion} onStartDaily={onStartDaily} onReviewDaily={onReviewDaily} onSpendMore={onSpendMore} devotionHistory={devotionHistory} />,",
    "    home: <HomeDashboard dailyVerse={dailyVerse} dailyLoading={dailyLoading} dailyError={dailyError} dailyRefreshing={dailyRefreshing} dailyRefreshError={dailyRefreshError} completed={completed} officialDevotion={officialDevotion} onStartDaily={onStartDaily} onRefreshDaily={onRefreshDaily} onReviewDaily={onReviewDaily} onSpendMore={onSpendMore} devotionHistory={devotionHistory} />,",
    path,
  );

  write(path, content);
}

function updateTodayCard() {
  const path = 'src/components/TodayDevotionCard.jsx';
  write(path, `import { useState } from 'react';\nimport { getDailyDevotionReminder } from '../data/devotionReminders.js';\nimport { getManilaDateKey } from '../lib/manilaTime.js';\n\nconst REVEALED_SESSION_KEY = 'ekklesiaPulse.todayDevotionRevealedDate';\n\nfunction wasRevealedToday(dateKey) {\n  if (typeof window === 'undefined') return false;\n\n  try {\n    return window.sessionStorage.getItem(REVEALED_SESSION_KEY) === dateKey;\n  } catch (error) {\n    console.warn('Today’s devotion reveal state could not be restored.', error);\n    return false;\n  }\n}\n\nexport default function TodayDevotionCard({\n  dailyVerse,\n  officialDevotion,\n  completed,\n  loading,\n  error,\n  refreshing,\n  refreshError,\n  onRefresh,\n  onStart,\n  onReview,\n  onSpendMore,\n}) {\n  const dateKey = getManilaDateKey();\n  const reminder = getDailyDevotionReminder(dateKey);\n  const [revealed, setRevealed] = useState(() => wasRevealedToday(dateKey));\n\n  function revealDevotion() {\n    setRevealed(true);\n\n    try {\n      window.sessionStorage.setItem(REVEALED_SESSION_KEY, dateKey);\n    } catch (storageError) {\n      console.warn('Today’s devotion reveal state could not be saved.', storageError);\n    }\n  }\n\n  if (dailyVerse && completed) {\n    const reference = officialDevotion?.reference || dailyVerse.reference;\n    return (\n      <section className="today-card today-card-complete" aria-label="Today’s devotion is complete">\n        <div className="completion-status-row">\n          <span className="completion-check" aria-hidden="true">✓</span>\n          <span className="completion-badge">Completed today</span>\n        </div>\n\n        <div className="completion-copy">\n          <p className="verse-reference">{reference} · BSB</p>\n          <h3>Devotion complete</h3>\n        </div>\n\n        <div className="additional-devotion-actions">\n          <button className="card-button completion-review-button" type="button" onClick={onReview}>\n            Review today’s devotion\n            <span aria-hidden="true">→</span>\n          </button>\n          <button className="secondary-button spend-more-button" type="button" onClick={onSpendMore}>\n            Spend more time in the Word\n          </button>\n        </div>\n      </section>\n    );\n  }\n\n  return (\n    <div className={\`today-card-flip \${revealed ? 'is-revealed' : ''}\`}>\n      <div className="today-card-flip-inner">\n        <button\n          className="today-card today-card-face today-card-reminder"\n          type="button"\n          onClick={revealDevotion}\n          aria-hidden={revealed}\n          tabIndex={revealed ? -1 : 0}\n          aria-label={\`\${reminder} Flip to start today’s devotion.\`}\n        >\n          <span className="reminder-kicker">A gentle reminder</span>\n          <span className="reminder-message">{reminder}</span>\n          <span className="reminder-flip-prompt">\n            <span>Flip to start today’s devotion</span>\n            <span className="reminder-flip-icon" aria-hidden="true">↻</span>\n          </span>\n        </button>\n\n        <section\n          className="today-card today-card-face today-card-devotion"\n          aria-busy={loading || refreshing}\n          aria-hidden={!revealed}\n        >\n          <div className="today-card-topline">\n            <span className="soft-badge">Today&apos;s devotion</span>\n            <div className="daily-suggestion-tools">\n              <span className="reading-time">5 min read</span>\n              <button\n                className={\`daily-suggestion-refresh \${refreshing ? 'is-refreshing' : ''}\`}\n                type="button"\n                onClick={onRefresh}\n                disabled={loading || refreshing || !dailyVerse}\n                aria-label={refreshing ? 'Loading another devotion suggestion' : 'Show another devotion suggestion'}\n                title="Show another suggestion"\n              >\n                <span aria-hidden="true">↻</span>\n              </button>\n            </div>\n          </div>\n\n          {loading && <p className="status-message" aria-live="polite">Preparing today&apos;s Scripture…</p>}\n          {error && <p className="status-message error-message" role="alert">Today&apos;s verse could not be loaded. Please try again shortly.</p>}\n          {refreshError && <p className="suggestion-refresh-error" role="alert">{refreshError}</p>}\n\n          {dailyVerse && (\n            <>\n              <p className="verse-reference">{dailyVerse.reference} · BSB</p>\n              <h3>{dailyVerse.title}</h3>\n              <p>{dailyVerse.theme} — {dailyVerse.prompt}</p>\n              <button className="card-button" type="button" onClick={onStart} tabIndex={revealed ? 0 : -1}>\n                Choose today’s devotion\n                <span aria-hidden="true">→</span>\n              </button>\n            </>\n          )}\n        </section>\n      </div>\n    </div>\n  );\n}\n`);
}

function updateStyles() {
  const path = 'src/devotion-flip.css';
  let content = read(path);
  const marker = '.daily-suggestion-tools {';
  if (content.includes(marker)) return;

  content += `\n.daily-suggestion-tools {\n  position: relative;\n  z-index: 2;\n  display: flex;\n  align-items: center;\n  gap: 9px;\n}\n\n.daily-suggestion-refresh {\n  display: grid;\n  width: 34px;\n  height: 34px;\n  padding: 0;\n  place-items: center;\n  border: 1px solid rgba(232,217,170,.18);\n  border-radius: 999px;\n  color: #e8d9aa;\n  background: rgba(232,217,170,.07);\n  cursor: pointer;\n  transition: transform 180ms ease, background 180ms ease, border-color 180ms ease;\n}\n\n.daily-suggestion-refresh:hover:not(:disabled) {\n  border-color: rgba(232,217,170,.34);\n  background: rgba(232,217,170,.13);\n  transform: rotate(18deg);\n}\n\n.daily-suggestion-refresh:disabled {\n  cursor: wait;\n  opacity: .55;\n}\n\n.daily-suggestion-refresh.is-refreshing span {\n  animation: suggestion-refresh-spin 720ms linear infinite;\n}\n\n.suggestion-refresh-error {\n  position: relative;\n  z-index: 1;\n  margin: 14px 0 0;\n  color: #efb4a7;\n  font-size: .82rem;\n  line-height: 1.5;\n}\n\n@keyframes suggestion-refresh-spin {\n  to { transform: rotate(360deg); }\n}\n`;
  write(path, content);
}

updateApp();
updateDashboard();
updateTodayCard();
updateStyles();
console.log('Daily devotion suggestion refresh feature applied.');
