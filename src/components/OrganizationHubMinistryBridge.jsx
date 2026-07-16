import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import OrganizationHub from './OrganizationHub.jsx';

function getLegacyViewStorageKey(organizationId) {
  return `ekklesia-pulse-beta-view:${organizationId || 'church'}`;
}

export default function OrganizationHubMinistryBridge({
  workspace,
  onOpenMinistry,
  onNavigateApp,
  organization,
  ...props
}) {
  const hostRef = useRef(null);

  useEffect(() => {
    const root = document.documentElement;
    delete root.dataset.ekklesiaDemoView;
    delete root.dataset.ekklesiaMemberSection;

    try {
      window.localStorage.removeItem(getLegacyViewStorageKey(organization?.id));
    } catch (error) {
      console.warn('Ekklesia Pulse could not clear the retired beta view preference.', error);
    }

    function restoreLeaderView() {
      const shell = document.querySelector('.church-workspace-shell');
      if (!shell) return;

      shell.querySelectorAll('[data-beta-member-hidden="true"]').forEach((element) => {
        element.hidden = false;
        delete element.dataset.betaMemberHidden;
      });

      shell.querySelectorAll('.church-workspace-primary-nav > button').forEach((button) => {
        const originalLabel = button.dataset.betaNativeSectionLabel
          || button.dataset.betaOriginalSectionLabel;
        if (originalLabel && button.textContent.trim() !== originalLabel) {
          button.textContent = originalLabel;
        }
        button.hidden = false;
        delete button.dataset.betaMemberHidden;
        delete button.dataset.betaNativeSectionLabel;
        delete button.dataset.betaOriginalSectionLabel;
      });

      shell.querySelectorAll('.organization-section-nav button').forEach((button) => {
        button.hidden = false;
        delete button.dataset.betaMemberHidden;
        delete button.dataset.betaNativeSectionLabel;
        delete button.dataset.betaOriginalSectionLabel;
      });

      shell.querySelectorAll('[data-beta-admin-only="true"]').forEach((element) => {
        delete element.dataset.betaAdminOnly;
      });

      const role = shell.querySelector('.church-workspace-role');
      if (role?.dataset.betaOriginalRole) {
        role.textContent = role.dataset.betaOriginalRole;
        delete role.dataset.betaOriginalRole;
      }
    }

    restoreLeaderView();
    const frame = window.requestAnimationFrame(restoreLeaderView);
    return () => window.cancelAnimationFrame(frame);
  }, [organization?.id]);

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

        const ariaLabel = `Enter ${ministry.name} ministry room`;
        if (existingButton) {
          existingButton.textContent = 'Enter Ministry Room';
          existingButton.dataset.enterMinistryRoom = ministry.id;
          delete existingButton.dataset.openTargetType;
          existingButton.setAttribute('aria-label', ariaLabel);
          return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'organization-enter-ministry-room';
        button.dataset.enterMinistryRoom = ministry.id;
        button.textContent = 'Enter Ministry Room';
        button.setAttribute('aria-label', ariaLabel);
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
    observer.observe(host, { childList: true, subtree: true });
    host.addEventListener('click', handleClick);
    enhanceMinistryCards();

    return () => {
      observer.disconnect();
      host.removeEventListener('click', handleClick);
    };
  }, [workspace, onOpenMinistry]);

  function navigateUnifiedApp(section) {
    if (section === 'church') return;
    onNavigateApp?.(section);
  }

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <>
      <div ref={hostRef} className="organization-hub-ministry-bridge">
        <OrganizationHub organization={organization} {...props} />
      </div>

      {portalTarget ? createPortal(
        <nav className="church-unified-bottom-nav" aria-label="Main navigation">
          {[
            ['home', '⌂', 'Home'],
            ['church', '♧', 'Church'],
            ['pulse', '♡', 'Pulse'],
            ['tools', '✦', 'Tools'],
            ['profile', '○', 'Me'],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              type="button"
              className={id === 'church' ? 'is-active' : ''}
              aria-current={id === 'church' ? 'page' : undefined}
              onClick={() => navigateUnifiedApp(id)}
            >
              <span aria-hidden="true">{icon}</span>
              <small>{label}</small>
            </button>
          ))}
        </nav>,
        portalTarget,
      ) : null}
    </>
  );
}
