import { useMemo, useState } from 'react';
import './ChurchPulseFeed.css';

function createPrototypePosts(organization, workspace, profile) {
  const ministries = workspace?.ministries || [];
  const groups = workspace?.groups || [];
  const announcements = workspace?.home?.announcements || [];
  const currentName = profile?.displayName || 'A church member';

  const announcementPosts = announcements.slice(0, 2).map((item, index) => ({
    id: `announcement-${item.id || index}`,
    type: 'announcement',
    eyebrow: item.category || 'Church announcement',
    author: organization?.name || 'Church leadership',
    title: item.title,
    body: item.description,
    meta: [item.eventDate || item.date, item.time, item.location].filter(Boolean).join(' · '),
    symbol: index === 0 ? '✦' : '◎',
  }));

  const joinedMinistryIds = new Set(workspace?.currentMember?.ministryIds || []);
  const ministry = ministries.find((item) => joinedMinistryIds.has(item.id)) || ministries[0];
  const joinedGroupIds = new Set(workspace?.currentMember?.groupIds || []);
  const group = groups.find((item) => joinedGroupIds.has(item.id)) || groups[0];

  return [
    ...announcementPosts,
    {
      id: 'shared-devotion-demo',
      type: 'devotion',
      eyebrow: 'Shared devotion',
      author: currentName,
      title: 'God meets us in faithful, ordinary moments.',
      body: 'A member intentionally shared this short reflection with the church. Private WGAP answers, prayers, journals, and notes are never added automatically.',
      meta: 'Psalm 46:10 · Shared with the whole church',
      symbol: '☼',
    },
    {
      id: 'ministry-encouragement-demo',
      type: 'ministry',
      eyebrow: ministry ? ministry.name : 'Ministry encouragement',
      author: ministry ? `${ministry.name} leaders` : 'Ministry leaders',
      title: 'Serve from overflow, not exhaustion.',
      body: ministry?.description || 'A short encouragement from one of the church ministries.',
      meta: 'For ministry members and the wider church family',
      symbol: ministry?.icon || 'M',
    },
    {
      id: 'group-rhythm-demo',
      type: 'group',
      eyebrow: group ? group.name : 'Group rhythm',
      author: 'Ekklesia Pulse',
      title: 'Consistency grows when we encourage one another.',
      body: group?.purpose || 'A group update celebrating members who are building a steady devotional rhythm together.',
      meta: 'General rhythm only · Private devotion content stays protected',
      symbol: '◔',
    },
    {
      id: 'video-demo',
      type: 'video',
      eyebrow: 'Prototype video post',
      author: organization?.name || 'Church media team',
      title: 'A short worship moment will appear here.',
      body: 'This beta card represents a vertical church video. Real video upload and playback will be connected later without changing the feed layout.',
      meta: 'Video prototype · 0:28',
      symbol: '▶',
    },
  ];
}

export default function ChurchPulseFeed({ organization, workspace, profile }) {
  const posts = useMemo(() => createPrototypePosts(organization, workspace, profile), [organization, workspace, profile]);
  const [encouragedIds, setEncouragedIds] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [showPrivacy, setShowPrivacy] = useState(false);

  function toggle(list, setter, id) {
    setter(list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  return (
    <section className="church-pulse-feed" aria-label="Church Pulse feed">
      <div className="church-pulse-feed-topbar">
        <div className="church-pulse-feed-tabs" aria-label="Pulse feed filter">
          <button type="button">Following</button>
          <span aria-hidden="true">|</span>
          <button type="button" className="is-active" aria-current="page">For You</button>
        </div>
        <button className="church-pulse-feed-info" type="button" onClick={() => setShowPrivacy((current) => !current)} aria-expanded={showPrivacy} aria-label="Pulse privacy information">i</button>
      </div>

      {showPrivacy ? (
        <p className="church-pulse-feed-privacy">
          Only content deliberately shared with a Group, ministry, or the whole church can appear here. Private WGAP responses, prayers, journals, notebook photos, and notes stay private.
        </p>
      ) : null}

      <div className="church-pulse-feed-stream" aria-label="Church Pulse posts">
        {posts.map((post) => {
          const encouraged = encouragedIds.includes(post.id);
          const saved = savedIds.includes(post.id);
          return (
            <article className={`church-pulse-post church-pulse-post-${post.type}`} key={post.id}>
              <div className="church-pulse-post-visual" aria-hidden="true">
                <span>{post.symbol}</span>
                {post.type === 'video' ? <b>Tap to play prototype</b> : null}
              </div>

              <div className="church-pulse-post-copy">
                <p className="dashboard-eyebrow">{post.eyebrow}</p>
                <small>{post.author}</small>
                <h2>{post.title}</h2>
                <p>{post.body}</p>
                <em>{post.meta}</em>
              </div>

              <div className="church-pulse-post-actions" aria-label={`${post.title} actions`}>
                <button type="button" className={encouraged ? 'is-active' : ''} onClick={() => toggle(encouragedIds, setEncouragedIds, post.id)} aria-pressed={encouraged} aria-label={encouraged ? 'Remove encouragement' : 'Encourage this post'}>
                  <span aria-hidden="true">{encouraged ? '♥' : '♡'}</span><small>{encouraged ? 'Encouraged' : 'Encourage'}</small>
                </button>
                <button type="button" aria-label="Open reflection comments">
                  <span aria-hidden="true">◌</span><small>Reflect</small>
                </button>
                <button type="button" className={saved ? 'is-active' : ''} onClick={() => toggle(savedIds, setSavedIds, post.id)} aria-pressed={saved} aria-label={saved ? 'Remove from saved posts' : 'Save this post'}>
                  <span aria-hidden="true">{saved ? '▮' : '▯'}</span><small>{saved ? 'Saved' : 'Save'}</small>
                </button>
                <button type="button" aria-label="Share this post">
                  <span aria-hidden="true">↗</span><small>Share</small>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
