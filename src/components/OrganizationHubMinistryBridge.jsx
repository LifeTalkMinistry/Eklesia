import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import OrganizationHub from './OrganizationHub.jsx';
import './BetaChurchViewMode.css';

function getStorageKey(organizationId) {
  return `ekklesia-pulse-beta-view:${organizationId || 'church'}`;
}

function restoreMode(organizationId) {
  if (typeof window === 'undefined') return '';
  try {
    const saved = window.localStorage.getItem(getStorageKey(organizationId));
    return saved === 'admin' || saved === 'member' ? saved : '';
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore the beta church view.', error);
    return '';
  }
}

function BetaViewChooser({ currentMode, organizationName, canClose, onChoose, onClose }) {
  return (
    <div className="beta-view-mode-backdrop">
      <section className="beta-view-mode-dialog" role="dialog" aria-modal="true" aria-labelledby="beta-view-mode-title">
        <div className="beta-view-mode-heading">
          <div>
            <p className="dashboard-eyebrow">Beta experience</p>
            <h2 id="beta-view-mode-title">How would you like to explore?</h2>
          </div>
          {canClose ? <button type="button" onClick={onClose} aria-label="Close beta view selector">×</button> : null}
        </div>
        <p className="beta-view-mode-copy">
          Explore {organizationName || 'this church'} from either side of Ekklesia Pulse. This changes only the beta presentation—it does not change real membership or permission data.
        </p>
        <div className="beta-view-mode-options">
          <button className={`beta-view-mode-option ${currentMode === 'admin' ? 'is-selected' : ''}`} type="button" onClick={() => onChoose('admin')}>
            <span aria-hidden="true">A</span>
            <strong>Explore as Church Leader</strong>
            <small>See the welcoming church board, announcements, ministry management, access codes, roles, Groups, and Church Pulse tools.</small>
          </button>
          <button className={`beta-view-mode-option ${currentMode === 'member' ? 'is-selected' : ''}`} type="button" onClick={() => onChoose('member')}>
            <span aria-hidden="true">M</span>
            <strong>Explore as Church Member</strong>
            <small>See a quieter everyday experience focused on church updates, joined ministries, joined Groups, events, and participation.</small>
          </button>
        </div>
        <p className="beta-view-mode-note">Members retain full access to the shared spaces they have joined, including Group rhythm, member, and about sections. You can switch views again at any time.</p>
      </section>
    </div>
  );
}

export default function OrganizationHubMinistryBridge({ workspace, onOpenMinistry, organization, ...props }) {
  const hostRef = useRef(null);
  const [mode, setMode] = useState(() => restoreMode(organization?.id));
  const [showChooser, setShowChooser] = useState(() => !restoreMode(organization?.id));

  useEffect(() => {
    const presentationMode = mode || 'admin';
    document.documentElement.dataset.ekklesiaDemoView = presentationMode;

    const shell = document.querySelector('.church-workspace-shell');
    if (!shell) return undefined;

    function setMemberHidden(element, hidden) {
      if (!element) return;
      if (hidden && !element.hidden) {
        element.dataset.betaMemberHidden = 'true';
        element.hidden = true;
      } else if (!hidden && element.dataset.betaMemberHidden === 'true') {
        delete element.dataset.betaMemberHidden;
        element.hidden = false;
      }
    }

    function applyPresentation() {
      const memberView = presentationMode === 'member';
      const role = shell.querySelector('.church-workspace-role');
      if (role) {
        if (!role.dataset.betaOriginalRole) role.dataset.betaOriginalRole = role.textContent;
        const nextRole = memberView ? 'Church Member · Beta member view' : role.dataset.betaOriginalRole;
        if (role.textContent !== nextRole) role.textContent = nextRole;
      }

      shell.querySelectorAll('.church-workspace-primary-nav button, .organization-section-nav button').forEach((button) => {
        const label = button.textContent.trim().toLowerCase();
        setMemberHidden(button, memberView && ['pulse', 'people', 'privacy'].includes(label));
      });

      shell.querySelectorAll('button').forEach((button) => {
        // A joined Group is a normal member space. Never apply the admin presentation
        // filter inside GroupWorkspace; members need Our Rhythm, Members, About,
        // progress summaries, and normal Group navigation.
        if (button.closest('.group-workspace')) {
          if (button.dataset.betaAdminOnly === 'true') delete button.dataset.betaAdminOnly;
          return;
        }

        const label = button.textContent.trim();
        const adminOnly = /^(assign|rotate|create group|admin tools|manage|edit|delete)/i.test(label);
        if (adminOnly && button.dataset.betaAdminOnly !== 'true') button.dataset.betaAdminOnly = 'true';
        else if (!adminOnly && button.dataset.betaAdminOnly === 'true') delete button.dataset.betaAdminOnly;
      });
    }

    applyPresentation();
    const observer = new MutationObserver(applyPresentation);
    observer.observe(shell, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [mode]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    function enhanceMinistryCards() {
      const joinedIds = new Set(workspace?.currentMember?.ministryIds || []);
      const ministryCards = host.querySelectorAll('.organization-ministry-card');

      ministryCards.forEach((card, index) => {
        const ministry = workspace?.ministries?.[index];
        const actions = card.querySelector('.organization-inline-actions');
        if (!ministry || !actions) return;

        const existingButton = actions.querySelector('[data-enter-ministry-room]');
        if (!joinedIds.has(ministry.id)) {
          existingButton?.remove();
          return;
        }

        if (existingButton) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'organization-enter-ministry-room';
        button.dataset.enterMinistryRoom = ministry.id;
        button.textContent = 'Enter Ministry Room';
        button.setAttribute('aria-label', `Enter ${ministry.name} ministry room`);
        actions.appendChild(button);
      });
    }

    function handleClick(event) {
      const button = event.target.closest('[data-enter-ministry-room]');
      if (!button || !host.contains(button)) return;
      const ministryId = button.dataset.enterMinistryRoom;
      const isJoined = (workspace?.currentMember?.ministryIds || []).includes(ministryId);
      if (isJoined) onOpenMinistry(ministryId);
    }

    const observer = new MutationObserver(enhanceMinistryCards);
    observer.observe(host, { childList: true, subtree: true, characterData: true });
    host.addEventListener('click', handleClick);
    enhanceMinistryCards();

    return () => {
      observer.disconnect();
      host.removeEventListener('click', handleClick);
    };
  }, [workspace, onOpenMinistry]);

  function chooseMode(nextMode) {
    try {
      window.localStorage.setItem(getStorageKey(organization?.id), nextMode);
    } catch (error) {
      console.warn('Ekklesia Pulse could not save the beta church view.', error);
    }
    setMode(nextMode);
    setShowChooser(false);
    if (nextMode === 'member') {
      window.requestAnimationFrame(() => {
        const homeButton = [...document.querySelectorAll('.church-workspace-primary-nav button')]
          .find((button) => button.textContent.trim().toLowerCase() === 'home');
        homeButton?.click();
      });
    }
  }

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <>
      <div ref={hostRef} className="organization-hub-ministry-bridge">
        <OrganizationHub organization={organization} {...props} />
      </div>
      {portalTarget ? createPortal(
        <>
          <button className="beta-view-mode-switch" type="button" onClick={() => setShowChooser(true)}>
            {mode === 'member' ? 'Member view' : 'Admin view'} · Switch
          </button>
          {showChooser ? (
            <BetaViewChooser
              currentMode={mode}
              organizationName={organization?.name}
              canClose={Boolean(mode)}
              onChoose={chooseMode}
              onClose={() => setShowChooser(false)}
            />
          ) : null}
        </>,
        portalTarget,
      ) : null}
    </>
  );
}
