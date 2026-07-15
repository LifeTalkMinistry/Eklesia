import { useEffect, useMemo, useRef, useState } from 'react';
import ChurchAnnouncementBillboard from './ChurchAnnouncementBillboard.jsx';
import ChurchHomeAdmin from './ChurchHomeAdmin.jsx';
import './ChurchHome.css';

function createDemoHome(organization) {
  const now = new Date().toISOString();
  return {
    announcements: [
      {
        id: 'announcement-level-up',
        category: `THIS WEEK AT ${organization.name.toUpperCase()}`,
        title: 'LEVEL UP: Identity Seminar',
        description: 'Discover who you are in Christ and how your identity shapes your decisions, relationships, and calling.',
        dateLabel: 'Featured this week',
        eventDate: 'Saturday',
        time: '2:00 PM',
        location: 'Main Sanctuary',
        actionLabel: 'View details',
        connectedMinistryId: 'youth',
        connectedGroupId: '',
        featured: true,
        imageUrl: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'announcement-sunday-schedule',
        category: 'WORSHIP SCHEDULE',
        title: 'Sunday Worship Schedule',
        description: 'Our Sunday worship service begins at 9:00 AM this week. Please arrive early for prayer and fellowship.',
        dateLabel: 'Posted today',
        eventDate: 'Sunday',
        time: '9:00 AM',
        location: 'Main Sanctuary',
        actionLabel: 'View schedule',
        connectedMinistryId: '',
        connectedGroupId: '',
        featured: true,
        imageUrl: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'announcement-outreach-volunteers',
        category: 'VOLUNTEER CALL',
        title: 'Outreach Volunteer Call',
        description: 'The Outreach Ministry needs ten volunteers to help serve families in the community this Saturday.',
        dateLabel: 'Applications close Friday',
        eventDate: 'Saturday',
        time: '8:00 AM',
        location: 'Church Lobby',
        actionLabel: 'See volunteer details',
        connectedMinistryId: 'outreach',
        connectedGroupId: '',
        featured: true,
        imageUrl: '',
        createdAt: now,
        updatedAt: now,
      },
    ],
    acknowledgements: [
      {
        id: 'ack-level-up-team',
        category: 'Ministry appreciation',
        title: 'Thank you, Youth Ministry',
        message: 'We celebrate every leader and volunteer who prepared the LEVEL UP experience for our young people.',
        dateLabel: 'This week',
        memberId: '',
        ministryId: 'youth',
        groupId: '',
        approvedForChurchDisplay: true,
        imageUrl: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'ack-sunday-volunteers',
        category: 'Volunteer appreciation',
        title: 'Thank you for serving',
        message: 'Thank you to everyone who welcomed guests, prepared the sanctuary, and served during Sunday worship.',
        dateLabel: 'Sunday',
        memberId: '',
        ministryId: '',
        groupId: '',
        approvedForChurchDisplay: true,
        imageUrl: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'ack-new-members',
        category: 'Church family',
        title: 'Welcome to our new members',
        message: 'We are grateful to welcome 12 new members into the Amazing Hope Church family.',
        dateLabel: 'This month',
        memberId: '',
        ministryId: '',
        groupId: '',
        approvedForChurchDisplay: true,
        imageUrl: '',
        createdAt: now,
        updatedAt: now,
      },
    ],
    events: [
      {
        id: 'event-prayer-meeting',
        title: 'Wednesday Prayer Meeting',
        description: 'A church-wide evening of prayer, Scripture, and encouragement.',
        date: 'Wednesday',
        time: '7:00 PM',
        location: 'Prayer Hall',
        ministryId: '',
        groupId: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'event-sunday-worship',
        title: 'Sunday Worship Service',
        description: 'Gather with the church family for worship, teaching, and fellowship.',
        date: 'Sunday',
        time: '9:00 AM',
        location: 'Main Sanctuary',
        ministryId: '',
        groupId: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'event-music-practice',
        title: 'Music Ministry Practice',
        description: 'Weekly preparation for the Sunday worship service.',
        date: 'Sunday',
        time: '7:00 AM',
        location: 'Music Room',
        ministryId: 'music',
        groupId: '',
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

function normalizeHome(home, organization) {
  const defaults = createDemoHome(organization);
  return {
    announcements: Array.isArray(home?.announcements) ? home.announcements : defaults.announcements,
    acknowledgements: Array.isArray(home?.acknowledgements) ? home.acknowledgements : defaults.acknowledgements,
    events: Array.isArray(home?.events) ? home.events : defaults.events,
  };
}

function DetailsDialog({ item, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    function handleEscape(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const description = item.description || item.message;
  const schedule = [item.eventDate || item.date, item.time, item.location].filter(Boolean).join(' · ');

  return (
    <div className="church-home-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="church-home-dialog church-home-details-dialog" role="dialog" aria-modal="true" aria-labelledby="church-home-details-title">
        <div className="church-home-dialog-heading">
          <div><p className="dashboard-eyebrow">{item.category || 'Church activity'}</p><h2 id="church-home-details-title">{item.title}</h2></div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close details">×</button>
        </div>
        {schedule ? <p className="church-home-details-schedule">{schedule}</p> : null}
        <p className="church-home-details-copy">{description}</p>
        <div className="church-home-dialog-actions"><button className="church-home-primary-action" type="button" onClick={onClose}>Done</button></div>
      </section>
    </div>
  );
}

const EXPLORE_LINKS = [
  ['pulse', 'Church Pulse', 'See the church’s shared rhythm without exposing private devotion content.', '◔'],
  ['ministries', 'Ministries', 'Explore the official ministries of the church.', 'M'],
  ['groups', 'Groups', 'Discover purpose-driven spaces led by appointed leaders.', 'G'],
  ['people', 'People', 'View members and appointed church roles.', 'P'],
  ['privacy', 'Privacy', 'Understand what the church can and cannot see.', '◇'],
];

export default function ChurchHome({ organization, profile, workspace, onWorkspaceChange, onOpenGroup, onNavigate, onShowDetails }) {
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const [detailsItem, setDetailsItem] = useState(null);
  const [status, setStatus] = useState('');
  const migratedRef = useRef(false);
  const home = useMemo(() => normalizeHome(workspace.home, organization), [workspace.home, organization]);
  const currentRole = workspace.currentMember?.organizationRole || 'Church Member';
  const isAdmin = ['Organization Owner', 'Organization Admin', 'Organization Manager'].includes(currentRole);
  const currentMemberName = profile?.displayName || 'Current member';
  const joinedMinistryIds = new Set(workspace.currentMember?.ministryIds || []);
  const joinedGroupIds = new Set(workspace.currentMember?.groupIds || []);
  const joinedMinistries = (workspace.ministries || []).filter((ministry) => joinedMinistryIds.has(ministry.id));
  const joinedGroups = (workspace.groups || []).filter((group) => joinedGroupIds.has(group.id));
  const approvedAcknowledgements = home.acknowledgements.filter((item) => item.approvedForChurchDisplay);
  const announcementsToShow = showAllAnnouncements ? home.announcements : home.announcements.slice(0, 3);
  const eventsToShow = showAllEvents ? home.events : home.events.slice(0, 3);

  useEffect(() => {
    const needsMigration = !workspace.home
      || !Array.isArray(workspace.home.announcements)
      || !Array.isArray(workspace.home.acknowledgements)
      || !Array.isArray(workspace.home.events);
    if (!needsMigration || migratedRef.current) return;
    migratedRef.current = true;
    onWorkspaceChange((current) => ({ ...current, home }));
  }, [workspace.home, home, onWorkspaceChange]);

  function updateHome(nextHome) {
    onWorkspaceChange((current) => ({ ...current, home: nextHome }));
  }

  function leaderName(group) {
    if (group.leaderId === 'current-member') return currentMemberName;
    return (workspace.members || []).find((member) => member.id === group.leaderId)?.name || 'Appointed leader';
  }

  function connectedLabel(item) {
    const ministry = (workspace.ministries || []).find((entry) => entry.id === (item.connectedMinistryId || item.ministryId));
    const group = (workspace.groups || []).find((entry) => entry.id === (item.connectedGroupId || item.groupId));
    return group?.name || ministry?.name || '';
  }

  return (
    <div className="church-home">
      {status ? <p className="church-home-status" role="status">{status}</p> : null}

      <ChurchAnnouncementBillboard
        announcements={home.announcements}
        onViewDetails={setDetailsItem}
        onAddToCalendar={(announcement) => setStatus(`${announcement.title} is ready to be added when calendar integration becomes available.`)}
      />

      <section className="church-home-section" aria-labelledby="church-home-announcements-title">
        <div className="church-home-section-heading">
          <div><p className="dashboard-eyebrow">Latest announcements</p><h2 id="church-home-announcements-title">Know what is happening</h2></div>
          {home.announcements.length > 3 ? <button type="button" onClick={() => setShowAllAnnouncements((current) => !current)}>{showAllAnnouncements ? 'Show less' : 'View all announcements'}</button> : null}
        </div>
        <div className="church-home-announcement-grid">
          {announcementsToShow.map((announcement) => (
            <article className="church-home-announcement-card" key={announcement.id}>
              <span>{announcement.category}</span>
              <h3>{announcement.title}</h3>
              <p>{announcement.description}</p>
              <div><small>{announcement.dateLabel}</small><button type="button" onClick={() => setDetailsItem(announcement)}>View details →</button></div>
            </article>
          ))}
        </div>
      </section>

      <section className="church-home-section" aria-labelledby="church-home-celebrating-title">
        <div className="church-home-section-heading">
          <div><p className="dashboard-eyebrow">Celebrating our church family</p><h2 id="church-home-celebrating-title">Honor people. Remember grace.</h2></div>
        </div>
        <div className="church-home-acknowledgement-list">
          {approvedAcknowledgements.map((acknowledgement, index) => (
            <article key={acknowledgement.id}>
              <span aria-hidden="true">{['✦', '♡', '＋'][index % 3]}</span>
              <div><small>{acknowledgement.category} · {acknowledgement.dateLabel}</small><h3>{acknowledgement.title}</h3><p>{acknowledgement.message}</p></div>
            </article>
          ))}
        </div>
        <p className="church-home-privacy-note">Acknowledgements are manually approved church content. Private prayers, reflections, journals, WGAP responses, and Group conversations are never used automatically.</p>
      </section>

      <section className="church-home-section" aria-labelledby="church-home-spaces-title">
        <div className="church-home-section-heading"><div><p className="dashboard-eyebrow">Your spaces</p><h2 id="church-home-spaces-title">Continue where you belong</h2></div><span>{joinedMinistries.length + joinedGroups.length} joined</span></div>
        {joinedMinistries.length || joinedGroups.length ? (
          <div className="church-home-spaces-grid">
            {joinedMinistries.map((ministry) => (
              <button key={ministry.id} type="button" onClick={() => onNavigate('ministries')}>
                <span className="church-home-space-icon" aria-hidden="true">{ministry.icon || 'M'}</span>
                <span><small>Official ministry</small><strong>{ministry.name}</strong><em>Open ministry →</em></span>
              </button>
            ))}
            {joinedGroups.map((group) => (
              <button key={group.id} type="button" onClick={() => onOpenGroup(group.id)}>
                <span className="church-home-space-icon" aria-hidden="true">G</span>
                <span><small>Leader-created Group · Led by {leaderName(group)}</small><strong>{group.name}</strong><em>Open Group →</em></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="church-home-empty-state"><p>You have not joined a ministry or Group yet.</p><div><button type="button" onClick={() => onNavigate('ministries')}>Explore ministries</button><button type="button" onClick={() => onNavigate('groups')}>Explore Groups</button></div></div>
        )}
      </section>

      <section className="church-home-section" aria-labelledby="church-home-coming-up-title">
        <div className="church-home-section-heading">
          <div><p className="dashboard-eyebrow">Coming up</p><h2 id="church-home-coming-up-title">Gather with the church</h2></div>
          {home.events.length > 3 ? <button type="button" onClick={() => setShowAllEvents((current) => !current)}>{showAllEvents ? 'Show less' : 'View church calendar'}</button> : <button type="button" onClick={() => setShowAllEvents(true)}>View church calendar</button>}
        </div>
        <div className="church-home-event-list">
          {eventsToShow.map((event) => (
            <article key={event.id}>
              <div className="church-home-event-date"><strong>{event.date}</strong><span>{event.time}</span></div>
              <div><h3>{event.title}</h3><p>{event.location}{connectedLabel(event) ? ` · ${connectedLabel(event)}` : ''}</p></div>
              <button type="button" onClick={() => setDetailsItem(event)}>View details</button>
            </article>
          ))}
        </div>
      </section>

      <section className="church-home-section" aria-labelledby="church-home-explore-title">
        <div className="church-home-section-heading"><div><p className="dashboard-eyebrow">Explore the church</p><h2 id="church-home-explore-title">Find your next place</h2></div></div>
        <div className="church-home-explore-grid">
          {EXPLORE_LINKS.map(([id, title, description, icon]) => (
            <button key={id} type="button" onClick={() => onNavigate(id)}>
              <span aria-hidden="true">{icon}</span><strong>{title}</strong><small>{description}</small><b aria-hidden="true">→</b>
            </button>
          ))}
        </div>
      </section>

      {isAdmin ? (
        <ChurchHomeAdmin
          organization={organization}
          workspace={workspace}
          home={home}
          onWorkspaceChange={onWorkspaceChange}
          onHomeChange={updateHome}
          onNavigate={onNavigate}
          onShowDetails={onShowDetails}
        />
      ) : null}

      {detailsItem ? <DetailsDialog item={detailsItem} onClose={() => setDetailsItem(null)} /> : null}
    </div>
  );
}
