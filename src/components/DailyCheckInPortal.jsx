import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MANILA_TIME_ZONE } from '../lib/manilaTime.js';
import { getEcosystemMembers, getJoinedEcosystem } from '../services/ecosystemService.js';
import './DailyCheckInPortal.css';

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
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

function WeeklyRhythm({ member, todayIndex, accessible = false }) {
  return (
    <div
      className={`daily-rhythm-week ${accessible ? 'member-visitor-week' : ''}`}
      aria-label={accessible ? `${member.name}'s shared weekly devotion rhythm` : undefined}
      aria-hidden={accessible ? undefined : 'true'}
    >
      {WEEKDAY_LABELS.map((label, dayIndex) => {
        const future = dayIndex > todayIndex;
        const completed = !future && member.checkIns[dayIndex];
        const today = dayIndex === todayIndex;
        const status = future ? 'upcoming' : completed ? 'completed' : 'not completed';

        return (
          <div className="daily-rhythm-day" key={`${member.id}-${dayIndex}`}>
            <span
              className={`daily-rhythm-circle ${completed ? 'is-complete' : ''} ${today ? 'is-today' : ''} ${future ? 'is-future' : ''}`}
              aria-label={accessible ? `${WEEKDAY_NAMES[dayIndex]}: ${status}` : undefined}
              aria-current={accessible && today ? 'date' : undefined}
            >
              {completed ? '✓' : label}
            </span>
            <small>{label}</small>
          </div>
        );
      })}
    </div>
  );
}

function MemberVisitorPage({ member, ranking, memberCount, elapsedDays, todayIndex, onBack }) {
  const backButtonRef = useRef(null);
  const completedToday = Boolean(member.checkIns[todayIndex]);

  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);

  return (
    <section className="member-visitor-page" aria-labelledby="member-visitor-heading">
      <button
        ref={backButtonRef}
        className="member-visitor-back"
        type="button"
        onClick={onBack}
      >
        <span aria-hidden="true">←</span> Back to weekly ranking
      </button>

      <div className="member-visitor-identity">
        <span className="member-visitor-avatar" aria-hidden="true">{member.name.charAt(0)}</span>
        <div>
          <p className="dashboard-eyebrow">Shared progress summary</p>
          <h3 id="member-visitor-heading">{member.name}</h3>
          <p>{getRhythmLabel(member, elapsedDays)}</p>
        </div>
      </div>

      <section className="member-visitor-rhythm" aria-labelledby="member-week-heading">
        <div className="member-visitor-section-heading">
          <div>
            <p className="dashboard-eyebrow">Devotional rhythm</p>
            <h4 id="member-week-heading">This week</h4>
          </div>
          <strong>{member.completedCount} of {elapsedDays}</strong>
        </div>
        <WeeklyRhythm member={member} todayIndex={todayIndex} accessible />
      </section>

      <div className="member-visitor-stats">
        <article>
          <span>Position</span>
          <strong>{ranking} of {memberCount}</strong>
          <small>Lowest completion appears first</small>
        </article>
        <article>
          <span>Current streak</span>
          <strong>{member.currentStreak} {member.currentStreak === 1 ? 'day' : 'days'}</strong>
          <small>Based on this week</small>
        </article>
        <article>
          <span>Today</span>
          <strong>{completedToday ? 'Completed' : 'Not yet'}</strong>
          <small>{member.devotionCheckInLabel || member.status}</small>
        </article>
      </div>

      <section className="member-visitor-signal" aria-labelledby="growth-signal-heading">
        <p className="dashboard-eyebrow">General growth signal</p>
        <h4 id="growth-signal-heading">{member.growthSignal || getRhythmLabel(member, elapsedDays)}</h4>
        <p>Last activity: {member.lastActiveLabel || 'No recent activity shown'}</p>
      </section>

      <aside className="member-visitor-privacy">
        <strong>Summary view only</strong>
        <p>WGAP answers, prayers, reflection text, Bible-reading details, and full devotion history remain private.</p>
      </aside>
    </section>
  );
}

function DailyCheckIn({ members, loading, error }) {
  const [selectedMemberId, setSelectedMemberId] = useState(null);
  const todayIndex = getTodayIndex();
  const elapsedDays = todayIndex + 1;
  const checkedInCount = members.filter((member) => member.devotionCompletedWithin24Hours).length;
  const rankedMembers = prepareRankedMembers(members, todayIndex);
  const selectedMemberIndex = rankedMembers.findIndex((member) => member.id === selectedMemberId);
  const selectedMember = selectedMemberIndex >= 0 ? rankedMembers[selectedMemberIndex] : null;

  if (selectedMember) {
    return (
      <section className="together-card daily-checkin-card member-visitor-card">
        <MemberVisitorPage
          member={selectedMember}
          ranking={selectedMemberIndex + 1}
          memberCount={rankedMembers.length}
          elapsedDays={elapsedDays}
          todayIndex={todayIndex}
          onBack={() => setSelectedMemberId(null)}
        />
      </section>
    );
  }

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
        Members who may need attention appear first. Tap a member to view their shared progress summary.
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
              >
                <button
                  className="daily-rhythm-row-button"
                  type="button"
                  onClick={() => setSelectedMemberId(member.id)}
                  aria-label={`View ${member.name}'s shared progress summary. Rank ${rankingIndex + 1}, ${member.completedCount} of ${elapsedDays} elapsed days completed.`}
                >
                  <div className="daily-rhythm-member-line">
                    <span className="daily-rhythm-rank" aria-hidden="true">{rankingIndex + 1}</span>
                    <span className="daily-checkin-avatar" aria-hidden="true">{member.name.charAt(0)}</span>
                    <div className="daily-checkin-member">
                      <strong>{member.name}</strong>
                      <small>{getRhythmLabel(member, elapsedDays)}</small>
                    </div>
                    <span className="daily-rhythm-meta">
                      <span className="daily-rhythm-score">{member.completedCount} of {elapsedDays}</span>
                      <span className="daily-rhythm-chevron" aria-hidden="true">›</span>
                    </span>
                  </div>

                  <WeeklyRhythm member={member} todayIndex={todayIndex} />
                </button>
              </article>
            );
          })}
        </div>
      ) : null}

      <p className="daily-checkin-principle">
        Only progress summaries are shared. Personal devotion responses and prayers stay private. Prototype data only.
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
