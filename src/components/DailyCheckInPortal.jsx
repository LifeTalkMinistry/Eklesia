import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getEcosystemMembers, getJoinedEcosystem } from '../services/ecosystemService.js';
import './DailyCheckInPortal.css';

function DailyCheckIn({ members, loading, error }) {
  const checkedInCount = members.filter((member) => member.devotionCompletedWithin24Hours).length;

  return (
    <section className="together-card daily-checkin-card" aria-labelledby="daily-checkin-heading">
      <div className="daily-checkin-heading">
        <div>
          <p className="dashboard-eyebrow">Daily accountability</p>
          <h3 id="daily-checkin-heading">Today’s devotion check-in</h3>
        </div>
        {!loading && !error ? (
          <span className="daily-checkin-count" aria-label={`${checkedInCount} of ${members.length} displayed members checked in`}>
            {checkedInCount} of {members.length}
          </span>
        ) : null}
      </div>

      <p className="daily-checkin-intro">
        See who completed a devotion within the last 24 hours.
      </p>

      {loading ? (
        <p className="daily-checkin-loading" role="status">Loading today’s check-ins…</p>
      ) : null}

      {error ? (
        <p className="daily-checkin-error" role="alert">Today’s prototype check-ins could not be loaded.</p>
      ) : null}

      {!loading && !error ? (
        <div className="daily-checkin-list" role="list" aria-label="Daily devotion check-in status">
          {members.map((member) => {
            const checkedIn = Boolean(member.devotionCompletedWithin24Hours);

            return (
              <article className={`daily-checkin-row ${checkedIn ? 'is-checked-in' : 'is-waiting'}`} key={member.id} role="listitem">
                <span className="daily-checkin-avatar" aria-hidden="true">{member.name.charAt(0)}</span>
                <div className="daily-checkin-member">
                  <strong>{member.name}</strong>
                  <small>{member.devotionCheckInLabel || (checkedIn ? 'Completed within the last 24 hours' : 'No check-in yet in this 24-hour window')}</small>
                </div>
                <span className="daily-checkin-status">
                  <span aria-hidden="true">{checkedIn ? '✓' : '○'}</span>
                  {checkedIn ? 'Checked in' : 'Not yet'}
                </span>
              </article>
            );
          })}
        </div>
      ) : null}

      <p className="daily-checkin-principle">
        No rankings and no scores. This is simply a clear daily accountability signal.
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
