import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MemberConnections from './MemberConnections.jsx';
import OrganizationHub from './OrganizationHub.jsx';
import './BetaChurchViewMode.css';

const MEMBER_SECTIONS = new Set(['home', 'ministries', 'groups', 'people']);
const MEMBER_HUB_SECTIONS = new Set(['ministries', 'groups', 'people']);

function sectionButtonLabel(button) {
  return String(button?.dataset?.betaOriginalSectionLabel || button?.textContent || '')
    .trim()
    .toLowerCase();
}

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
            <small>See the Church Board, Ministries, Groups, and the friends or close companions saved under People.</small>
          </button>
        </div>
        <p className="beta-view-mode-note">You can switch views again at any time using the beta view button inside the church workspace.</p>
      </section>
    </div>
  );
}

export default function OrganizationHubMinistryBridge({ workspace, onOpenMinistry, onNavigateApp, organization, ...props }) {
  const hostRef = useRef(null);
  const [mode, setMode] = useState(() => restoreMode(organization?.id));
  const [showChooser, setShowChooser] = useState(() => !restoreMode(organization?.id));
  const [memberSection, setMemberSection] = useState('home');
  const [contentTarget, setContentTarget] = useState(null);

  useEffect(() => {
    setContentTarget(document.querySelector('.church-workspace-content'));
  }, []);

  useEffect(() => {
    const presentationMode = mode || 'admin';
    document.documentElement.dataset.ekklesiaDemoView = presentationMode;
    document.documentElement.dataset.ekklesiaMemberSection = memberSection;

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

    function preserveSectionLabel(button) {
      if (!button.dataset.betaOriginalSectionLabel) {
        button.dataset.betaOriginalSectionLabel = button.textContent.trim();
      }
      return sectionButtonLabel(button);
    }

    function applyPresentation() {
      const memberView = presentationMode === 'member';
      const groupWorkspace = shell.querySelector('.group-workspace');
      const role = shell.querySelector('.church-workspace-role');
      if (role) {
        if (!role.dataset.betaOriginalRole) role.dataset.betaOriginalRole = role.textContent;
        const nextRole = memberView ? 'Church Member · Beta member view' : role.dataset.betaOriginalRole;
        if (role.textContent !== nextRole) role.textContent = nextRole;
      }

      shell.querySelectorAll('.church-workspace-primary-nav button').forEach((button) => {
        const label = preserveSectionLabel(button);
        setMemberHidden(button, memberView && !MEMBER_SECTIONS.has(label));
        const nextLabel = memberView && label === 'home'
          ? 'Church Board'
          : button.dataset.betaOriginalSectionLabel;
        if (button.textContent.trim() !== nextLabel) button.textContent = nextLabel;
      });

      shell.querySelectorAll('.organization-section-nav button').forEach((button) => {
        const label = preserveSectionLabel(button);
        setMemberHidden(button, memberView && !MEMBER_HUB_SECTIONS.has(label));
      });

      shell.querySelectorAll('button').forEach((button) => {
        if (groupWorkspace?.contains(button)) {
          if (button.dataset.betaAdminOnly === 'true') delete button.dataset.betaAdminOnly;
          return;
        }
        const label = button.textContent.trim();
        const adminOnly = /^(assign|rotate|create group|admin tools|manage|edit|delete)/i.test(label);
        if (adminOnly && button.dataset.betaAdminOnly !== 'true') button.dataset.betaAdminOnly = 'true';
        else if (!adminOnly && button.dataset.betaAdminOnly === 'true') delete button.dataset.betaAdminOnly;
      });
    }

    function handleSectionNavigation(event) {
      if (presentationMode !== 'member') return;
      const button = event.target.closest('.church-workspace-primary-nav button, .organization-section-nav button');
      if (!button || !shell.contains(button)) return;
      const label = sectionButtonLabel(button);
      if (MEMBER_SECTIONS.has(label)) setMemberSection(label);
    }

    applyPresentation();
    const observer = new MutationObserver(applyPresentation);
    observer.observe(shell, { childList: true, subtree: true, characterData: true });
    shell.addEventListener('click', handleSectionNavigation);
    return () => {
      observer.disconnect();
      shell.removeEventListener('click', handleSectionNavigation);
    };
  }, [mode, memberSection]);

  useEffect(() => {
    if (mode !== 'member') return undefined;
    const frame = window.requestAnimationFrame(() => navigateMember('home'));
    return () => window.cancelAnimationFrame(frame);
  }, [mode, organization?.id]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    function joinedGroupForMinistry(ministryId) {
      const joinedGroupIds = new Set(workspace?.currentMember?.groupIds || []);
      return (workspace?.groups || []).find((group) => (
        group.connectedMinistryId === ministryId && joinedGroupIds.has(group.id)
      ));
    }

    function enhanceMinistryCards() {
      const joinedIds = new Set(workspace?.currentMember?.ministryIds || []);
      const ministryCards = host.querySelectorAll('.organization-ministry-card');
      const memberView = (mode || 'admin') === 'member';

      ministryCards.forEach((card, index) => {
        const ministry = workspace?.ministries?.[index];
        const actions = card.querySelector('.organization-inline-actions');
        if (!ministry || !actions) return;

        const existingButton = actions.querySelector('[data-enter-ministry-room]');
        if (!joinedIds.has(ministry.id)) {
          existingButton?.remove();
          return;
        }

        const joinedGroup = joinedGroupForMinistry(ministry.id);
        const actionLabel = memberView && joinedGroup ? 'Open Group' : 'Enter Ministry Room';
        const actionTarget = memberView && joinedGroup ? joinedGroup.id : ministry.id;
        const actionType = memberView && joinedGroup ? 'group' : 'ministry';
        const ariaLabel = actionType === 'group' ? `Open ${joinedGroup.name}` : `Enter ${ministry.name} ministry room`;

        if (existingButton) {
          if (existingButton.textContent !== actionLabel) existingButton.textContent = actionLabel;
          if (existingButton.dataset.enterMinistryRoom !== actionTarget) existingButton.dataset.enterMinistryRoom = actionTarget;
          if (existingButton.dataset.openTargetType !== actionType) existingButton.dataset.openTargetType = actionType;
          if (existingButton.getAttribute('aria-label') !== ariaLabel) existingButton.setAttribute('aria-label', ariaLabel);
          return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'organization-enter-ministry-room';
        button.dataset.enterMinistryRoom = actionTarget;
        button.dataset.openTargetType = actionType;
        button.textContent = actionLabel;
        button.setAttribute('aria-label', ariaLabel);
        actions.appendChild(button);
      });
    }

    function openGroupThroughChurchHome(groupId) {
      const group = (workspace?.groups || []).find((entry) => entry.id === groupId);
      if (!group) return;

      const homeButton = [...document.querySelectorAll('.church-workspace-primary-nav button')]
        .find((button) => sectionButtonLabel(button) === 'home');
      homeButton?.click();

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const groupButton = [...document.querySelectorAll('.church-home-spaces-grid button')]
            .find((button) => button.querySelector('strong')?.textContent.trim() === group.name);
          groupButton?.click();
        });
      });
    }

    function handleClick(event) {
      const button = event.target.closest('[data-enter-ministry-room]');
      if (!button || !host.contains(button)) return;

      const targetId = button.dataset.enterMinistryRoom;
      if (button.dataset.openTargetType === 'group') {
        const isJoined = (workspace?.currentMember?.groupIds || []).includes(targetId);
        if (isJoined) openGroupThroughChurchHome(targetId);
        return;
      }

      const isJoined = (workspace?.currentMember?.ministryIds || []).includes(targetId);
      if (isJoined) onOpenMinistry(targetId);
    }

    const observer = new MutationObserver(enhanceMinistryCards);
    observer.observe(host, { childList: true, subtree: true });
    host.addEventListener('click', handleClick);
    enhanceMinistryCards();

    return () => {
      observer.disconnect();
      host.removeEventListener('click', handleClick);
    };
  }, [workspace, onOpenMinistry, mode]);

  function navigateMember(section) {
    setMemberSection(section);
    const targetButton = [...document.querySelectorAll('.church-workspace-primary-nav button')]
      .find((button) => sectionButtonLabel(button) === section);
    targetButton?.click();
  }

  function navigateUnifiedApp(section) {
    if (section === 'church') return;
    onNavigateApp?.(section);
  }

  function chooseMode(nextMode) {
    try {
      window.localStorage.setItem(getStorageKey(organization?.id), nextMode);
    } catch (error) {
      console.warn('Ekklesia Pulse could not save the beta church view.', error);
    }
    setMode(nextMode);
    setMemberSection('home');
    setShowChooser(false);
    if (nextMode === 'member') {
      window.requestAnimationFrame(() => navigateMember('home'));
    }
  }

  const portalTarget = typeof document !== 'undefined' ? document.body : null;
  const memberMode = mode === 'member';

  return (
    <>
      <div ref={hostRef} className="organization-hub-ministry-bridge">
        <OrganizationHub organization={organization} {...props} />
      </div>

      {memberMode && contentTarget && memberSection === 'people' ? createPortal(
        <div className="member-connections-portal">
          <MemberConnections organization={organization} workspace={workspace} />
        </div>,
        contentTarget,
      ) : null}

      {portalTarget ? createPortal(
        <>
          <nav className="church-unified-bottom-nav" aria-label="Main navigation">
            {[
              ['home', '⌂', 'Home'],
              ['church', '♧', 'Church'],
              ['pulse', '♡', 'Pulse'],
              ['tools', '✦', 'Tools'],
              ['profile', '○', 'Me'],
            ].map(([id, icon, label]) => (
              <button key={id} type="button" className={id === 'church' ? 'is-active' : ''} aria-current={id === 'church' ? 'page' : undefined} onClick={() => navigateUnifiedApp(id)}>
                <span aria-hidden="true">{icon}</span><small>{label}</small>
              </button>
            ))}
          </nav>
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
