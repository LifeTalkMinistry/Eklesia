import { useEffect, useMemo, useRef, useState } from 'react';
import { MANILA_TIME_ZONE } from '../lib/manilaTime.js';
import './DailyCheckInPortal.css';
import './GroupWorkspace.css';

const GROUP_SECTIONS = [
  ['rhythm', 'Our Rhythm'],
  ['members', 'Members'],
  ['about', 'About'],
];

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

function prepareMembers(members, todayIndex) {
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
  if (member.currentStreak > 1) return `${member.currentStreak}-day streak`;
  return `${member.completedCount} completed ${member.completedCount === 1 ? 'day' : 'days'}`;
}

function WeeklyRhythm({ member, todayIndex, accessible = false }) {
  return (
    <div
      className="daily-rhythm-week"
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

function SharedMemberSummary({ member, ranking, memberCount, elapsedDays, todayIndex, onBack }) {
  const backButtonRef = useRef(null);
  const completedToday = Boolean(member.checkIns[todayIndex]);

  useEffect(() => {
    backButtonRef.current?.focus();
  }, []);

  return (
    <section className="group-member-summary" aria-labelledby="group-member-summary-heading">
      <button ref={backButtonRef} className="group-workspace-back-link" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Back to group rhythm
      </button>

      <div className="group-member-identity">
        <span aria-hidden="true">{member.name.charAt(0)}</span>
        <div>
          <p className="dashboard-eyebrow">Shared progress summary</p>
          <h3 id="group-member-summary-heading">{member.name}</h3>
          <p>{getRhythmLabel(member, elapsedDays)}</p>
        </div>
      </div>

      <section className="group-member-week" aria-labelledby="group-member-week-heading">
        <div className="group-workspace-section-heading">
          <div><p className="dashboard-eyebrow">Devotional rhythm</p><h4 id="group-member-week-heading">This week</h4></div>
          <strong>{member.completedCount} of {elapsedDays}</strong>
        </div>
        <WeeklyRhythm member={member} todayIndex={todayIndex} accessible />
      </section>

      <div className="group-member-stats">
        <article><span>Attention order</span><strong>{ranking} of {memberCount}</strong><small>Lower weekly completion appears first</small></article>
        <article><span>Current streak</span><strong>{member.currentStreak} {member.currentStreak === 1 ? 'day' : 'days'}</strong><small>Based on this week</small></article>
        <article><span>Today</span><strong>{completedToday ? 'Completed' : 'Not yet'}</strong><small>{member.devotionCheckInLabel || member.status}</small></article>
      </div>

      <section className="group-member-signal">
        <p className="dashboard-eyebrow">General growth signal</p>
        <h4>{member.growthSignal || getRhythmLabel(member, elapsedDays)}</h4>
        <p>Last activity: {member.lastActiveLabel || 'No recent activity shown'}</p>
      </section>

      <aside className="group-workspace-privacy-note">
        <strong>Progress summary only</strong>
        <p>WGAP responses, prayers, reflection text, exact Bible passages, journal entries, and full devotion history remain private.</p>
      </aside>
    </section>
  );
}

function RhythmView({ members }) {
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const todayIndex = getTodayIndex();
  const elapsedDays = todayIndex + 1;
  const rankedMembers = useMemo(() => prepareMembers(members, todayIndex), [members, todayIndex]);
  const checkedInToday = rankedMembers.filter((member) => member.checkIns[todayIndex]).length;
  const selectedMemberIndex = rankedMembers.findIndex((member) => member.id === selectedMemberId);
  const selectedMember = selectedMemberIndex >= 0 ? rankedMembers[selectedMemberIndex] : null;

  if (selectedMember) {
    return (
      <section className="daily-checkin-card group-rhythm-card">
        <SharedMemberSummary
          member={selectedMember}
          ranking={selectedMemberIndex + 1}
          memberCount={rankedMembers.length}
          elapsedDays={elapsedDays}
          todayIndex={todayIndex}
          onBack={() => setSelectedMemberId('')}
        />
      </section>
    );
  }

  return (
    <section className="daily-checkin-card group-rhythm-card" aria-labelledby="group-rhythm-heading">
      <div className="daily-checkin-heading">
        <div><p className="dashboard-eyebrow">Group accountability</p><h3 id="group-rhythm-heading">This week</h3></div>
        <span className="daily-checkin-count" aria-label={`${checkedInToday} of ${rankedMembers.length} displayed group members completed today`}>
          {checkedInToday} of {rankedMembers.length} today
        </span>
      </div>

      <p className="daily-checkin-intro">Members who may need attention appear first. Tap a member to view the progress summary they share with this group.</p>

      {rankedMembers.length ? (
        <div className="daily-checkin-list" role="list" aria-label="Weekly group devotion accountability">
          {rankedMembers.map((member, rankingIndex) => {
            const perfect = member.completedCount === elapsedDays;

            return (
              <article className={`daily-rhythm-row ${perfect ? 'is-perfect' : ''}`} key={member.id} role="listitem">
                <button
                  className="group-rhythm-row-button"
                  type="button"
                  onClick={() => setSelectedMemberId(member.id)}
                  aria-label={`View ${member.name}'s shared progress summary. ${member.completedCount} of ${elapsedDays} elapsed days completed.`}
                >
                  <div className="daily-rhythm-member-line">
                    <span className="daily-rhythm-rank" aria-hidden="true">{rankingIndex + 1}</span>
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
      ) : <p className="group-workspace-empty">No shared member rhythm is available in this prototype group yet.</p>}

      <p className="daily-checkin-principle">This is an accountability order, not a spiritual score. It helps the appointed leader notice who may appreciate encouragement first.</p>
    </section>
  );
}

export default function GroupWorkspace({ organization, workspace, group, profile, onBack }) {
  const [section, setSection] = useState('rhythm');
  const headingRef = useRef(null);
  const currentMemberName = profile?.displayName || 'Current member';
  const ministries = workspace.ministries || [];
  const connectedMinistry = ministries.find((ministry) => ministry.id === group.connectedMinistryId);
  const memberIds = Array.isArray(group.memberIds) && group.memberIds.length ? new Set(group.memberIds) : null;

  const displayMembers = useMemo(() => {
    const members = (workspace.members || [])
      .filter((member) => !memberIds || memberIds.has(member.id))
      .map((member) => member.id === 'current-member' ? { ...member, name: currentMemberName } : member);

    const currentMemberJoined = (workspace.currentMember?.groupIds || []).includes(group.id);
    if (currentMemberJoined && !members.some((member) => member.id === 'current-member')) {
      members.unshift({
        id: 'current-member',
        name: currentMemberName,
        status: 'Your current rhythm',
        growthSignal: 'Your shared group rhythm',
        lastActiveLabel: 'Today',
        devotionCompletedWithin24Hours: false,
        devotionCheckInLabel: 'No shared signal available yet',
        weeklyCheckIns: [false, false, false, false, false, false, false],
      });
    }

    return members;
  }, [workspace.members, workspace.currentMember, group.id, memberIds, currentMemberName]);

  const leaderName = group.leaderId === 'current-member'
    ? currentMemberName
    : (workspace.members || []).find((member) => member.id === group.leaderId)?.name || 'Appointed leader';

  useEffect(() => {
    headingRef.current?.focus();
  }, [group.id]);

  return (
    <section className="group-workspace" aria-labelledby="group-workspace-title">
      <button className="group-workspace-back" type="button" onClick={onBack}>
        <span aria-hidden="true">←</span> Back to church Groups
      </button>

      <header className="group-workspace-hero">
        <div className="group-workspace-hero-topline">
          <span>{connectedMinistry?.name || 'Church-wide group'}</span>
          <span className="group-workspace-joined">✓ Joined</span>
        </div>
        <p className="dashboard-eyebrow">Leader-created group</p>
        <h2 id="group-workspace-title" ref={headingRef} tabIndex="-1">{group.name}</h2>
        <p className="group-workspace-purpose">{group.purpose}</p>
        <div className="group-workspace-quick-details">
          <span><small>Appointed leader</small><strong>{leaderName}</strong></span>
          <span><small>Group members</small><strong>{group.memberCount} of {group.memberLimit}</strong></span>
          <span><small>Duration</small><strong>{group.duration}</strong></span>
        </div>
      </header>

      <nav className="group-workspace-nav" aria-label={`${group.name} sections`}>
        {GROUP_SECTIONS.map(([id, label]) => (
          <button key={id} type="button" className={section === id ? 'is-active' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>{label}</button>
        ))}
      </nav>

      {section === 'rhythm' ? <RhythmView members={displayMembers} /> : null}

      {section === 'members' ? (
        <section className="group-workspace-panel" aria-labelledby="group-members-heading">
          <div className="group-workspace-section-heading">
            <div><p className="dashboard-eyebrow">Group roster</p><h3 id="group-members-heading">Members sharing their rhythm</h3></div>
            <strong>{displayMembers.length} shown</strong>
          </div>
          <p className="group-workspace-panel-intro">The prototype shows only members with a general rhythm signal available to this group.</p>
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
          <div className="group-workspace-section-heading"><div><p className="dashboard-eyebrow">Group details</p><h3 id="group-about-heading">Purpose and access</h3></div></div>
          <dl className="group-workspace-about-list">
            <div><dt>Church</dt><dd>{organization.name}</dd></div>
            <div><dt>Purpose</dt><dd>{group.purpose}</dd></div>
            <div><dt>Intended members</dt><dd>{group.intendedMembers}</dd></div>
            <div><dt>Appointed leader</dt><dd>{leaderName}</dd></div>
            <div><dt>Connected ministry</dt><dd>{connectedMinistry?.name || 'None · Church-wide or cross-ministry'}</dd></div>
            <div><dt>Visibility</dt><dd>{group.visibility}</dd></div>
            <div><dt>Joining</dt><dd>{group.approvalRequired ? 'Leader approval required' : 'Automatic after valid code'}</dd></div>
            <div><dt>Duration</dt><dd>{group.duration}</dd></div>
          </dl>
        </section>
      ) : null}

      <aside className="group-workspace-privacy-note group-workspace-footer-note">
        <strong>This group sees rhythm, not private devotion content.</strong>
        <p>Joining does not reveal WGAP answers, prayers, journals, notebook photos, personal notes, or exact Scripture selections.</p>
      </aside>
    </section>
  );
}
