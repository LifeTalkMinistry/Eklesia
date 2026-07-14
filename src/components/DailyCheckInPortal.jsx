import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { MANILA_TIME_ZONE } from '../lib/manilaTime.js';
import { getEcosystemMembers, getJoinedEcosystem } from '../services/ecosystemService.js';
import './DailyCheckInPortal.css';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_INDEX = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

function getTodayIndex() {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: MANILA_TIME_ZONE,
  }).format(new Date());

  return WEEKDAY_INDEX[weekday] ?? 0;
}

function getMemberWeek(member, todayIndex) {
  if (Array.isArray(member.weeklyCheckIns)) {
    return Array.from({ length: 7 }, (_, index) => Boolean(member.weeklyCheckIns[index]));
  }

  return Array.from(
    { length: 7 },
    (_, index) => index === todayIndex && Boolean(member.devotionCompletedWithin24Hours),
  );
}

function getCurrentStreak(checkIns, todayIndex) {
  let streak = 0;

  for (let index = todayIndex; index >= 0; index -= 1) {
    if (!checkIns[index]) break;
    streak += 1;
  }

  return streak;
}

function prepareRankedMembers(members, todayIndex) {
  const elapsedDays = todayIndex + 1;

  return members
    .map((member, originalIndex) => {
      const checkIns = getMemberWeek(member, todayIndex);
      const completedCount = checkIns.slice(0, elapsedDays).filter(Boolean).length;
      const currentStreak = getCurrentStreak(checkIns, todayIndex);

      return {
        ...member,
        checkIns,
        completedCount,
        currentStreak,
        originalIndex,
      };
    })
    .sort((first, second) => (
      first.completedCount - second.completedCount
      || first.currentStreak - second.currentStreak
      || first.originalIndex - second.originalIndex
    ));
}

function getRhythmLabel(member, elapsedDays) {
  if (member.completedCount === elapsedDays) return 'Perfect rhythm so far';
  if (member.completedCount === 0) return 'No completed day yet';
  if (member.currentStreak === 1) return '1-day streak';
  return `${member.currentStreak}-day streak`;
}

function DailyCheckIn({ members, loading, error }) {
  const todayIndex = getTodayIndex();
  const elapsedDays = todayIndex + 1;
  const checkedInCount = members.filter((member) => member.devotionCompletedWithin24Hours).length;
  const rankedMembers = prepareRankedMembers(members, todayIndex);

  return (
    <section className="together-card daily-checkin-card" aria-labelledby="daily-checkin-heading">
      <div className="daily-checkin-heading">
        <div>
          <p className="dashboard-eyebrow">Daily accountability</p>
          <h3 id="daily-checkin-heading">This week</h3>
        </div>
        {!loading && !error ? (
          <span className="daily-checkin-count" aria-label={`${checkedInCount} of ${members.length} displayed members checked in today`}>
            {checkedInCount} of {members.length} today
          </span>
        ) : null}
      </div>

      <p className="daily-checkin-intro">
        Members who may need attention appear first. Stronger and perfect rhythms appear lower in the list.
      </p>

      {loading ? (
        <p className="daily-checkin-loading" role="status">Loading this week’s rhythms…</p>
      ) : null}

      {error ? (
        <p className="daily-checkin-error" role="alert">This week’s prototype rhythms could not be loaded.</p>
      ) : null}

      {!loading && !error ? (
        <div className="daily-checkin-list" role="list" aria-label="Weekly devotion accountability ranking">
          {rankedMembers.map((member, rankingIndex) => {
            const perfect = member.completedCount === elapsedDays;

            return (
              <article
                className={`daily-rhythm-row ${perfect ? 'is-perfect' : ''}`}
                key={member.id}
                role="listitem"
                aria-label={`${member.name}, rank ${rankingIndex + 1}, ${member.completedCount} of ${elapsedDays} elapsed days completed`}
              >
                <div className="daily-rhythm-member-line">
                  <span className="daily-rhythm-rank" aria-hidden="true">{rankingIndex + 1}</span>
                  <span className="daily-checkin-avatar" aria-hidden="true">{member.name.charAt(0)}</span>
                  <div className="daily-checkin-member">
                    <strong>{member.name}</strong>
                    <small>{getRhythmLabel(member, elapsedDays)}</small>
                  </div>
                  <span className="daily-rhythm-score">{member.completedCount} of {elapsedDays}</span>
                </div>

                <div className="daily-rhythm-week" aria-hidden="true">
                  {WEEKDAY_LABELS.map((label, dayIndex) => {
                    const future = dayIndex > todayIndex;
                    const completed = !future && member.checkIns[dayIndex];
                    const today = dayIndex === todayIndex;

                    return (
                      <div className="daily-rhythm-day" key={`${member.id}-${dayIndex}`}>
                        <span className={`daily-rhythm-circle ${completed ? 'is-complete' : ''} ${today ? 'is-today' : ''} ${future ? 'is-future' : ''}`}>
                          {completed ? '✓' : label}
                        </span>
                        <small>{label}</small>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      <p className="daily-checkin-principle">
        Ordered from the lowest weekly completion count to the strongest rhythm. Prototype data only.
      </p>
    </section>
  );
}

export default function DailyCheckInPortal() {
  const [portalTarget, setPortalTarget] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let host = null;
    let currentAnchor = null;

    async function loadMembers() {
      setLoading(true);
      setError(false);

      const ecosystemResult = await getJoinedEcosystem();
      if (cancelled) return;

      if (!ecosystemResult.ok || !ecosystemResult.data) {
        setMembers([]);
        setLoading(false);
        setError(true);
        return;
      }

      const memberResult = await getEcosystemMembers(ecosystemResult.data.id);
      if (cancelled) return;

      if (!memberResult.ok) {
        setMembers([]);
        setLoading(false);
        setError(true);
        return;
      }

      setMembers(memberResult.data);
      setLoading(false);
    }

    function removeHost() {
      if (host?.isConnected) host.remove();
      host = null;
      currentAnchor = null;
      setPortalTarget(null);
    }

    function syncPortalTarget() {
      const anchor = document.querySelector('.together-joined-page .together-heading-row');

      if (!anchor) {
        if (host) removeHost();
        return;
      }

      if (anchor === currentAnchor && host?.isConnected) return;

      if (host?.isConnected) host.remove();
      currentAnchor = anchor;
      host = document.createElement('div');
      host.className = 'daily-checkin-portal-host';
      host.dataset.prototypeFeature = 'daily-devotion-check-in';
      anchor.insertAdjacentElement('afterend', host);
      setPortalTarget(host);
      loadMembers();
    }

    syncPortalTarget();

    const dashboardContent = document.querySelector('.dashboard-content') || document.body;
    const observer = new MutationObserver(syncPortalTarget);
    observer.observe(dashboardContent, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
      if (host?.isConnected) host.remove();
    };
  }, []);

  if (!portalTarget) return null;

  return createPortal(
    <DailyCheckIn members={members} loading={loading} error={error} />,
    portalTarget,
  );
}
