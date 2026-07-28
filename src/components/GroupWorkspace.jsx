import { useEffect, useMemo, useRef, useState } from 'react';
import { MANILA_TIME_ZONE } from '../lib/manilaTime.js';
import './DailyCheckInPortal.css';
import './GroupWorkspace.css';
import './GroupRhythmSimplified.css';

const GROUP_SECTIONS = [
  ['rhythm', 'Our Rhythm'],
  ['members', 'Members'],
  ['about', 'About'],
];

const MEMBER_HISTORY_RANGES = [
  ['week', 'This Week'],
  ['four-weeks', '4 Weeks'],
  ['three-months', '3 Months'],
];

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const WEEKDAY_INDEX = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

function getTodayIndex() {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: MANILA_TIME_ZONE,
  }).format(new Date());
  return WEEKDAY_INDEX[weekday] ?? 0;
}

function normalizeSharedWeek(value) {
  if (!Array.isArray(value)) return Array(7).fill(false);
  return Array.from({ length: 7 }, (_, index) => Boolean(value[index]));
}

function getMemberWeek(member, todayIndex) {
  if (Array.isArray(member.weeklyCheckIns)) {
    return normalizeSharedWeek(member.weeklyCheckIns);
  }
  return Array.from(
    { length: 7 },
    (_, index) => index === todayIndex && Boolean(member.devotionCompletedWithin24Hours),
  );
}

function getSharedWeeklyHistory(member) {
  const source = Array.isArray(member.sharedWeeklyHistory) ? member.sharedWeeklyHistory : [];
  return Array.from({ length: 3 }, (_, index) => {
    const entry = source[index];
    const rawCheckIns = Array.isArray(entry) ? entry : entry?.checkIns;
    const available = Array.isArray(rawCheckIns);
    const checkIns = normalizeSharedWeek(rawCheckIns);
    return {
      id: `previous-week-${index + 1}`,
      label: typeof entry?.label === 'string' && entry.label.trim()
        ? entry.label.trim()
        : `${index + 1} week${index ? 's' : ''} ago`,
      checkIns,
      completedCount: available ? checkIns.filter(Boolean).length : 0,
      trackedDays: available ? 7 : 0,
      available,
    };
  });
}

function getSharedMonthlyHistory(member) {
  const source = Array.isArray(member.sharedMonthlyHistory) ? member.sharedMonthlyHistory : [];
  const defaultLabels = ['This month', 'Previous month', 'Two months ago'];
  return Array.from({ length: 3 }, (_, index) => {
    const entry = source[index];
    const completedDays = Number(entry?.completedDays);
    const trackedDays = Number(entry?.trackedDays);
    const available = Number.isFinite(completedDays)
      && Number.isFinite(trackedDays)
      && trackedDays > 0
      && completedDays >= 0;
    return {
      id: `shared-month-${index}`,
      label: typeof entry?.label === 'string' && entry.label.trim()
        ? entry.label.trim()
        : defaultLabels[index],
      completedDays: available ? Math.min(completedDays, trackedDays) : 0,
      trackedDays: available ? trackedDays : 0,
      available,
    };
  });
}

function getThreeMonthTrend(months) {
  const available = months.filter((month) => month.available);
  if (available.length < 2) return 'Not enough shared history yet';

  const newest = available[0].completedDays / available[0].trackedDays;
  const oldest = available[available.length - 1].completedDays / available[available.length - 1].trackedDays;
  const difference = newest - oldest;

  if (difference >= 0.08) return 'Becoming more consistent';
  if (difference <= -0.08) return 'Recently less active';
  return 'Generally steady';
}

function getCurrentStreak(checkIns, todayIndex) {
  let streak = 0;
  for (let index = todayIndex; index >= 0; index -= 1) {
    if (!checkIns[index]) break;
    streak += 1;
  }
  return streak;
}

function prepareMembers(members, todayIndex) {
  const elapsedDays = todayIndex + 1;
  return members
    .map((member, originalIndex) => {
      const checkIns = getMemberWeek(member, todayIndex);
      const completedCount = checkIns.slice(0, elapsedDays).filter(Boolean).length;
      return {
        ...member,
        checkIns,
        completedCount,
        currentStreak: getCurrentStreak(checkIns, todayIndex),
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
  if (member.completedCount === elapsedDays) return 'Consistent rhythm so far';
  if (member.completedCount === 0) return 'No completed day yet';
  if (member.currentStreak === 1) return '1-day rhythm';
  if (member.currentStreak > 1) return `${member.currentStreak}-day rhythm`;
  return `${member.completedCount} completed ${member.completedCount === 1 ? 'day' : 'days'}`;
}

function WeeklyRhythm({
  member,
  todayIndex,
  accessible = false,
  checkIns = member.checkIns,
  markFuture = true,
  unavailable = false,
  instanceId = 'current',
}) {
  return (
    <div
      className={`daily-rhythm-week ${unavailable ? 'is-unavailable' : ''}`}
      aria-label={accessible ? `${member.name}'s shared weekly devotion rhythm` : undefined}
      aria-hidden={accessible ? undefined : 'true'}
    >
      {WEEKDAY_LABELS.map((label, dayIndex) => {
        const future = markFuture && dayIndex > todayIndex;
        const completed = !unavailable && !future && Boolean(checkIns?.[dayIndex]);
        const today = markFuture && dayIndex === todayIndex;
        const status = unavailable ? 'not shared' : future ? 'upcoming' : completed ? 'completed' : 'not completed';
        return (
          <div className="daily-rhythm-day" key={`${member.id}-${instanceId}-${dayIndex}`}>
            <span
              className={`daily-rhythm-circle ${completed ? 'is-complete' : ''} ${today ? 'is-today' : ''} ${future ? 'is-future' : ''} ${unavailable ? 'is-unavailable' : ''}`}
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

function FourWeekHistory({ member, elapsedDays, todayIndex }) {
  const previousWeeks = getSharedWeeklyHistory(member);
  const weeks = [
    {
      id: 'current-week',
      label: 'This week',
      checkIns: member.checkIns,
      completedCount: member.completedCount,
      trackedDays: elapsedDays,
      available: true,
      current: true,
    },
    ...previousWeeks,
  ];
  const availableWeeks = weeks.filter((week) => week.available);
  const completedDays = availableWeeks.reduce((total, week) => total + week.completedCount, 0);
  const trackedDays = availableWeeks.reduce((total, week) => total + week.trackedDays, 0);

  return (
    <section className="group-member-history-panel" aria-labelledby="group-member-four-week-heading">
      <div className="group-workspace-section-heading">
        <div>
          <p className="dashboard-eyebrow">Shared weekly signals</p>
          <h4 id="group-member-four-week-heading">Last 4 weeks</h4>
        </div>
        <strong>{completedDays} of {trackedDays || elapsedDays}</strong>
      </div>
      <p className="group-member-history-intro">
        Only completed-day signals voluntarily shared with this group are shown.
      </p>
      <div className="group-member-week-history-list">
        {weeks.map((week) => (
          <article className={`group-member-week-history-row ${week.available ? '' : 'is-unavailable'}`} key={week.id}>
            <div className="group-member-history-row-heading">
              <strong>{week.label}</strong>
              <span>{week.available ? `${week.completedCount} of ${week.trackedDays}` : 'Not shared'}</span>
            </div>
            <WeeklyRhythm
              member={member}
              todayIndex={week.current ? todayIndex : 6}
              checkIns={week.checkIns}
              markFuture={Boolean(week.current)}
              unavailable={!week.available}
              instanceId={week.id}
            />
            {!week.available ? <small>No earlier shared signal is available for this week.</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ThreeMonthHistory({ member }) {
  const months = getSharedMonthlyHistory(member);
  const trend = getThreeMonthTrend(months);
  const availableCount = months.filter((month) => month.available).length;

  return (
    <section className="group-member-history-panel" aria-labelledby="group-member-three-month-heading">
      <div className="group-workspace-section-heading">
        <div>
          <p className="dashboard-eyebrow">Care-focused trend</p>
          <h4 id="group-member-three-month-heading">Last 3 months</h4>
        </div>
        <strong>{availableCount} of 3 shared</strong>
      </div>
      <div className="group-member-trend-summary">
        <span>General trend</span>
        <strong>{trend}</strong>
        <small>Based only on shared completion totals—not devotion content.</small>
      </div>
      <div className="group-member-month-list">
        {months.map((month) => {
          const percentage = month.available
            ? Math.round((month.completedDays / month.trackedDays) * 100)
            : 0;
          return (
            <article className={month.available ? '' : 'is-unavailable'} key={month.id}>
              <div>
                <strong>{month.label}</strong>
                <span>{month.available ? `${month.completedDays} of ${month.trackedDays} days` : 'No shared summary'}</span>
              </div>
              <div className="group-member-month-meter" aria-hidden="true">
                <span style={{ width: `${percentage}%` }} />
              </div>
              <small>{month.available ? `${percentage}% shared rhythm` : 'This period remains unavailable.'}</small>
            </article>
          );
        })}
      </div>
      <p className="group-member-history-boundary">
        Detailed day-by-day history older than four weeks and yearly history remain private to the member.
      </p>
    </section>
  );
}

function SharedMemberSummary({ member, elapsedDays, todayIndex, onBack, isDGroup }) {
  const [historyRange, setHistoryRange] = useState('week');
  const backButtonRef = useRef(null);
  const completedToday = Boolean(member.checkIns[todayIndex]);

  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);

  return (
    <section className="group-member-summary" aria-labelledby="group-member-summary-heading">
      <button ref={backButtonRef} className="group-workspace-back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Back to {isDGroup ? 'D-Group' : 'group'} rhythm
      </button>
      <div className="group-member-identity">
        <span aria-hidden="true">{member.name.charAt(0)}</span>
        <div>
          <p className="dashboard-eyebrow">Shared progress summary</p>
          <h3 id="group-member-summary-heading">{member.name}</h3>
          <p>{getRhythmLabel(member, elapsedDays)}</p>
        </div>
      </div>
      <nav className="group-member-range-tabs" aria-label={`${member.name}'s shared progress range`}>
        {MEMBER_HISTORY_RANGES.map(([id, label]) => (
          <button
            className={historyRange === id ? 'is-active' : ''}
            type="button"
            key={id}
            aria-current={historyRange === id ? 'page' : undefined}
            onClick={() => setHistoryRange(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {historyRange === 'week' ? (
        <>
          <section className="group-member-week" aria-labelledby="group-member-week-heading">
            <div className="group-workspace-section-heading">
              <div><p className="dashboard-eyebrow">Devotional rhythm</p><h4 id="group-member-week-heading">This week</h4></div>
              <strong>{member.completedCount} of {elapsedDays}</strong>
            </div>
            <WeeklyRhythm member={member} todayIndex={todayIndex} accessible />
          </section>
          <div className="group-member-stats">
            <article><span>Current rhythm</span><strong>{member.currentStreak} {member.currentStreak === 1 ? 'day' : 'days'}</strong><small>Based on this week</small></article>
            <article><span>Today</span><strong>{completedToday ? 'Completed' : 'Not yet'}</strong><small>{member.devotionCheckInLabel || member.status}</small></article>
          </div>
        </>
      ) : null}
      {historyRange === 'four-weeks' ? (
        <FourWeekHistory member={member} elapsedDays={elapsedDays} todayIndex={todayIndex} />
      ) : null}
      {historyRange === 'three-months' ? <ThreeMonthHistory member={member} /> : null}
      <section className="group-member-signal">
        <p className="dashboard-eyebrow">General growth signal</p>
        <h4>{member.growthSignal || getRhythmLabel(member, elapsedDays)}</h4>
        <p>Last activity: {member.lastActiveLabel || 'No recent activity shown'}</p>
      </section>
      <aside className="group-workspace-privacy-note">
        <strong>Progress summary only</strong>
        <p>WGAP responses, prayers, reflection text, exact Bible passages, journal entries, and yearly personal history remain private.</p>
      </aside>
    </section>
  );
}

function RhythmView({ members, isDGroup }) {
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const todayIndex = getTodayIndex();
  const elapsedDays = todayIndex + 1;
  const orderedMembers = useMemo(() => prepareMembers(members, todayIndex), [members, todayIndex]);
  const checkedInToday = orderedMembers.filter((member) => member.checkIns[todayIndex]).length;
  const selectedMember = orderedMembers.find((member) => member.id === selectedMemberId) || null;

  if (selectedMember) {
    return (
      <section className="daily-checkin-card group-rhythm-card">
        <SharedMemberSummary
          member={selectedMember}
          elapsedDays={elapsedDays}
          todayIndex={todayIndex}
          isDGroup={isDGroup}
          onBack={() => setSelectedMemberId('')}
        />
      </section>
    );
  }

  return (
    <section className="daily-checkin-card group-rhythm-card" aria-labelledby="group-rhythm-heading">
      <div className="daily-checkin-heading">
        <div><p className="dashboard-eyebrow">{isDGroup ? 'D-Group accountability' : 'Group accountability'}</p><h3 id="group-rhythm-heading">This week</h3></div>
        <span className="daily-checkin-count" aria-label={`${checkedInToday} of ${orderedMembers.length} displayed members completed today`}>
          {checkedInToday} of {orderedMembers.length} today
        </span>
      </div>
      <p className="daily-checkin-intro">Members who may appreciate attention appear first. Tap a member to view only the progress summary they share.</p>
      {orderedMembers.length ? (
        <div className="daily-checkin-list" role="list" aria-label={`Weekly ${isDGroup ? 'D-Group' : 'group'} devotion accountability`}>
          {orderedMembers.map((member) => {
            const consistent = member.completedCount === elapsedDays;
            return (
              <article className={`daily-rhythm-row ${consistent ? 'is-perfect' : ''}`} key={member.id} role="listitem">
                <button
                  className="group-rhythm-row-button"
                  type="button"
                  onClick={() => setSelectedMemberId(member.id)}
                  aria-label={`View ${member.name}'s shared progress summary. ${member.completedCount} of ${elapsedDays} elapsed days completed.`}
                >
                  <div className="daily-rhythm-member-line">
                    <span className="daily-checkin-avatar" aria-hidden="true">{member.name.charAt(0)}</span>
                    <div className="daily-checkin-member"><strong>{member.name}</strong><small>{getRhythmLabel(member, elapsedDays)}</small></div>
                    <span className="group-rhythm-meta"><span className="daily-rhythm-score">{member.completedCount} of {elapsedDays}</span><span aria-hidden="true">›</span></span>
                  </div>
                  <WeeklyRhythm member={member} todayIndex={todayIndex} />
                </button>
              </article>
            );
          })}
        </div>
      ) : <p className="group-workspace-empty">No shared member rhythm is available here yet.</p>}
      <p className="daily-checkin-principle">This order is for care and encouragement, not ranking or spiritual scoring.</p>
    </section>
  );
}

export default function GroupWorkspace({ organization, workspace, group, profile, onBack }) {
  const [section, setSection] = useState('rhythm');
  const headingRef = useRef(null);
  const currentMemberName = profile?.displayName || 'Current member';
  const isDGroup = group.groupType === 'dgroup';
  const ministries = workspace.ministries || [];
  const connectedMinistry = ministries.find((ministry) => ministry.id === group.connectedMinistryId);
  const parentGroup = (workspace.groups || []).find((item) => item.id === group.parentGroupId);
  const networkName = workspace.dGroupNetwork?.name || 'D-Group Network';
  const memberIds = Array.isArray(group.memberIds) && group.memberIds.length ? new Set(group.memberIds) : null;

  const displayMembers = useMemo(() => {
    const organizationMembersById = new Map((organization.members || []).map((member) => [member.id, member]));
    const members = (workspace.members || [])
      .filter((member) => !memberIds || memberIds.has(member.id))
      .map((member) => {
        const defaultMember = organizationMembersById.get(member.id) || {};
        return {
          ...defaultMember,
          ...member,
          name: member.id === 'current-member' ? currentMemberName : member.name,
          sharedWeeklyHistory: member.sharedWeeklyHistory || defaultMember.sharedWeeklyHistory || [],
          sharedMonthlyHistory: member.sharedMonthlyHistory || defaultMember.sharedMonthlyHistory || [],
        };
      });
    const currentMemberJoined = (workspace.currentMember?.groupIds || []).includes(group.id);
    if (currentMemberJoined && !members.some((member) => member.id === 'current-member')) {
      const defaultMember = organizationMembersById.get('current-member') || {};
      members.unshift({
        ...defaultMember,
        id: 'current-member',
        name: currentMemberName,
        status: 'Your current rhythm',
        growthSignal: 'Your shared rhythm',
        lastActiveLabel: 'Today',
        devotionCompletedWithin24Hours: false,
        devotionCheckInLabel: 'No shared signal available yet',
        weeklyCheckIns: [false, false, false, false, false, false, false],
        sharedWeeklyHistory: defaultMember.sharedWeeklyHistory || [],
        sharedMonthlyHistory: defaultMember.sharedMonthlyHistory || [],
      });
    }
    return members;
  }, [organization.members, workspace.members, workspace.currentMember, group.id, memberIds, currentMemberName]);

  const leaderName = group.leaderId === 'current-member'
    ? currentMemberName
    : (workspace.members || []).find((member) => member.id === group.leaderId)?.name || 'Appointed leader';

  useEffect(() => {
    headingRef.current?.focus();
  }, [group.id]);

  return (
    <section className="group-workspace" aria-labelledby="group-workspace-title">
      <button className="group-workspace-back" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Back to {isDGroup ? 'D-Groups' : 'Ministries'}
      </button>
      <header className="group-workspace-hero">
        <div className="group-workspace-hero-topline">
          <span>{isDGroup ? networkName : connectedMinistry?.name || 'Church ministry group'}</span>
          <span className="group-workspace-joined">✓ Joined</span>
        </div>
        <p className="dashboard-eyebrow">{isDGroup ? 'Assigned D-Group' : 'Ministry-connected group'}</p>
        <h2 id="group-workspace-title" ref={headingRef} tabIndex="-1">{group.name}</h2>
        <p className="group-workspace-purpose">{group.purpose}</p>
        <div className="group-workspace-quick-details">
          <span><small>{isDGroup ? 'D-Group leader' : 'Appointed leader'}</small><strong>{leaderName}</strong></span>
          <span><small>{isDGroup ? 'Direct members' : 'Group members'}</small><strong>{group.memberCount} of {group.memberLimit}</strong></span>
          <span><small>{isDGroup ? 'Relationship' : 'Duration'}</small><strong>{isDGroup ? parentGroup ? `Under ${parentGroup.name}` : 'Primary D-Group' : group.duration}</strong></span>
        </div>
      </header>
      <nav className="group-workspace-nav" aria-label={`${group.name} sections`}>
        {GROUP_SECTIONS.map(([id, label]) => (
          <button key={id} type="button" className={section === id ? 'is-active' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>{label}</button>
        ))}
      </nav>
      {section === 'rhythm' ? <RhythmView members={displayMembers} isDGroup={isDGroup} /> : null}
      {section === 'members' ? (
        <section className="group-workspace-panel" aria-labelledby="group-members-heading">
          <div className="group-workspace-section-heading">
            <div><p className="dashboard-eyebrow">{isDGroup ? 'Direct disciples' : 'Group roster'}</p><h3 id="group-members-heading">Members sharing their rhythm</h3></div>
            <strong>{displayMembers.length} shown</strong>
          </div>
          <p className="group-workspace-panel-intro">Only general rhythm signals voluntarily shared with this {isDGroup ? 'D-Group' : 'group'} appear here.</p>
          <div className="group-workspace-member-list">
            {displayMembers.map((member) => {
              const todayIndex = getTodayIndex();
              const checkIns = getMemberWeek(member, todayIndex);
              const completedToday = checkIns[todayIndex];
              return (
                <article key={member.id}>
                  <span className="daily-checkin-avatar" aria-hidden="true">{member.name.charAt(0)}</span>
                  <div><strong>{member.name}</strong><small>{member.growthSignal || member.status || 'Shared progress member'}</small></div>
                  <span className={completedToday ? 'is-complete' : 'is-waiting'}>{completedToday ? '✓ Completed' : '○ Not yet'}</span>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
      {section === 'about' ? (
        <section className="group-workspace-panel" aria-labelledby="group-about-heading">
          <div className="group-workspace-section-heading"><div><p className="dashboard-eyebrow">{isDGroup ? 'D-Group relationship' : 'Group details'}</p><h3 id="group-about-heading">Purpose and access</h3></div></div>
          <dl className="group-workspace-about-list">
            <div><dt>Church</dt><dd>{organization.name}</dd></div>
            {isDGroup ? <div><dt>Network</dt><dd>{networkName}</dd></div> : null}
            <div><dt>Purpose</dt><dd>{group.purpose}</dd></div>
            <div><dt>{isDGroup ? 'D-Group leader' : 'Appointed leader'}</dt><dd>{leaderName}</dd></div>
            {isDGroup ? <div><dt>Parent D-Group</dt><dd>{parentGroup?.name || 'None · Primary D-Group'}</dd></div> : <div><dt>Connected ministry</dt><dd>{connectedMinistry?.name || 'Church-wide'}</dd></div>}
            <div><dt>Direct-member limit</dt><dd>{group.memberLimit}</dd></div>
            <div><dt>Visibility</dt><dd>{group.visibility}</dd></div>
            <div><dt>Joining</dt><dd>{group.approvalRequired ? 'Leader assignment or approval required' : 'Automatic after valid code'}</dd></div>
          </dl>
        </section>
      ) : null}
      <aside className="group-workspace-privacy-note group-workspace-footer-note">
        <strong>This {isDGroup ? 'D-Group' : 'group'} sees rhythm, not private devotion content.</strong>
        <p>Joining does not reveal WGAP answers, prayers, journals, notebook photos, personal notes, or exact Scripture selections.</p>
      </aside>
    </section>
  );
}
