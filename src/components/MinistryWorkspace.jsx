import { useMemo, useState } from 'react';
import './MinistryWorkspace.css';

const SECTIONS = [
  ['home', 'Home'],
  ['announcements', 'Announcements'],
  ['members', 'Members'],
  ['groups', 'Groups'],
];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export default function MinistryWorkspace({ organization, workspace, ministry, profile, onBack, onOpenGroup }) {
  const [section, setSection] = useState('home');
  const joinedMinistryIds = new Set(workspace.currentMember?.ministryIds || []);
  const joinedGroupIds = new Set(workspace.currentMember?.groupIds || []);
  const isMember = joinedMinistryIds.has(ministry.id);
  const currentMemberName = profile?.displayName || 'Current member';

  const leaders = useMemo(() => {
    const names = (workspace.members || []).flatMap((member) => (member.roles || [])
      .filter((role) => role.role === 'Ministry Leader' && role.scopeId === ministry.id)
      .map(() => member.name));
    if ((workspace.currentMember?.roles || []).some((role) => role.role === 'Ministry Leader' && role.scopeId === ministry.id)) {
      names.unshift(currentMemberName);
    }
    return unique(names);
  }, [workspace.members, workspace.currentMember?.roles, ministry.id, currentMemberName]);

  const connectedGroups = (workspace.groups || []).filter((group) => group.connectedMinistryId === ministry.id);
  const visibleMembers = (workspace.members || []).filter((member) => (member.roles || [])
    .some((role) => role.scopeId === ministry.id));
  const pulse = ministry.pulse || { completedToday: 0, activeThisWeek: 0 };
  const pulsePercent = ministry.memberCount ? Math.round((pulse.completedToday / ministry.memberCount) * 100) : 0;
  const announcements = (workspace.announcements || []).filter((announcement) => (
    announcement.ministryId === ministry.id || announcement.scopeId === ministry.id
  ));
  const safeAnnouncements = announcements.length ? announcements : [
    {
      id: `${ministry.id}-welcome`,
      title: `Welcome to ${ministry.name}`,
      description: `This ministry room is the shared prototype space for ${ministry.name} updates, people, and connected groups.`,
      category: 'Ministry update',
    },
    {
      id: `${ministry.id}-serve`,
      title: 'Serve together this week',
      description: 'Check with your ministry leaders for the latest schedule, assignments, and opportunities to help.',
      category: 'Serving reminder',
    },
  ];

  if (!isMember) {
    return (
      <section className="ministry-workspace ministry-workspace-locked" aria-labelledby="ministry-room-locked-title">
        <button className="ministry-workspace-back" type="button" onClick={onBack}>← Back to Ministries</button>
        <p className="dashboard-eyebrow">Ministry room</p>
        <h2 id="ministry-room-locked-title">Membership required</h2>
        <p>Join this ministry using its ministry code before entering the dedicated room.</p>
      </section>
    );
  }

  return (
    <section className="ministry-workspace" aria-labelledby="ministry-room-title">
      <button className="ministry-workspace-back" type="button" onClick={onBack}>← Back to Ministries</button>

      <header className="ministry-workspace-hero">
        <span className="ministry-workspace-icon" aria-hidden="true">{ministry.icon}</span>
        <div>
          <p className="dashboard-eyebrow">Dedicated ministry room</p>
          <h2 id="ministry-room-title">{ministry.name}</h2>
          <p>{ministry.description}</p>
        </div>
        <span className="ministry-workspace-membership">✓ You belong to this ministry</span>
      </header>

      <dl className="ministry-workspace-summary">
        <div><dt>Ministry leaders</dt><dd>{leaders.length ? leaders.join(', ') : 'Not assigned'}</dd></div>
        <div><dt>Members</dt><dd>{ministry.memberCount}</dd></div>
        <div><dt>Your status</dt><dd>Joined member</dd></div>
      </dl>

      <nav className="ministry-workspace-nav" aria-label={`${ministry.name} room sections`}>
        {SECTIONS.map(([id, label]) => (
          <button key={id} type="button" className={section === id ? 'is-active' : ''} aria-current={section === id ? 'page' : undefined} onClick={() => setSection(id)}>{label}</button>
        ))}
      </nav>

      {section === 'home' ? (
        <div className="ministry-workspace-stack">
          <section className="ministry-workspace-panel ministry-workspace-welcome">
            <p className="dashboard-eyebrow">Welcome</p>
            <h3>Welcome to the {ministry.name} room.</h3>
            <p>{ministry.description}</p>
          </section>
          <div className="ministry-workspace-metrics">
            <article><strong>{ministry.memberCount}</strong><span>members</span></article>
            <article><strong>{pulse.completedToday}</strong><span>completed today</span></article>
            <article><strong>{pulse.activeThisWeek}</strong><span>active this week</span></article>
            <article><strong>{pulsePercent}%</strong><span>ministry pulse</span></article>
          </div>
          <section className="ministry-workspace-panel">
            <p className="dashboard-eyebrow">Ministry leaders</p>
            <h3>{leaders.length ? leaders.join(', ') : 'Leaders have not been assigned yet.'}</h3>
          </section>
          <section className="ministry-workspace-panel">
            <div className="ministry-workspace-heading"><div><p className="dashboard-eyebrow">Connected groups</p><h3>Groups serving with this ministry</h3></div><span>{connectedGroups.length}</span></div>
            {connectedGroups.length ? (
              <div className="ministry-workspace-group-grid">
                {connectedGroups.map((group) => (
                  <article key={group.id}>
                    <h4>{group.name}</h4><p>{group.purpose}</p><small>{group.memberCount} of {group.memberLimit} members</small>
                    {joinedGroupIds.has(group.id) ? <button type="button" onClick={() => onOpenGroup(group.id)}>Open Group</button> : <span>Join from the Groups section</span>}
                  </article>
                ))}
              </div>
            ) : <p className="ministry-workspace-empty">No groups are connected to this ministry yet.</p>}
          </section>
        </div>
      ) : null}

      {section === 'announcements' ? (
        <div className="ministry-workspace-card-grid">
          {safeAnnouncements.map((announcement) => (
            <article key={announcement.id} className="ministry-workspace-panel">
              <span>{announcement.category || 'Announcement'}</span>
              <h3>{announcement.title}</h3>
              <p>{announcement.description}</p>
            </article>
          ))}
        </div>
      ) : null}

      {section === 'members' ? (
        <div className="ministry-workspace-stack">
          <section className="ministry-workspace-privacy-note"><strong>Member-safe information only</strong><p>This prototype room never displays private devotion reflections, WGAP answers, notes, or personal spiritual content.</p></section>
          <div className="ministry-workspace-member-list">
            <article><span aria-hidden="true">{currentMemberName.charAt(0)}</span><div><strong>{currentMemberName}</strong><small>You · Ministry member</small></div></article>
            {visibleMembers.map((member) => <article key={member.id}><span aria-hidden="true">{member.name.charAt(0)}</span><div><strong>{member.name}</strong><small>{(member.roles || []).find((role) => role.scopeId === ministry.id)?.role || 'Ministry member'}</small></div></article>)}
          </div>
          <p className="ministry-workspace-empty">Total ministry membership: {ministry.memberCount}. Only people already named in the prototype data are listed here.</p>
        </div>
      ) : null}

      {section === 'groups' ? (
        connectedGroups.length ? <div className="ministry-workspace-group-grid">{connectedGroups.map((group) => <article key={group.id}><h3>{group.name}</h3><p>{group.purpose}</p><small>{group.memberCount} of {group.memberLimit} members · {group.duration}</small>{joinedGroupIds.has(group.id) ? <button type="button" onClick={() => onOpenGroup(group.id)}>Open Group</button> : <span>Not joined</span>}</article>)}</div> : <p className="ministry-workspace-empty">No groups are connected to this ministry yet.</p>
      ) : null}
    </section>
  );
}
