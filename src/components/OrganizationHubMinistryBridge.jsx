import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import OrganizationHub from './OrganizationHub.jsx';

function getLegacyViewStorageKey(organizationId) {
  return `ekklesia-pulse-beta-view:${organizationId || 'church'}`;
}

function normalizeSectionLabel(value) {
  return String(value || '').trim().toLowerCase();
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

    const shell = host.closest('.church-workspace-shell');
    let syncFrame = 0;
    let enhancementFrame = 0;

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

        const buttonLabel = 'Enter Ministry Room';
        const ariaLabel = `Enter ${ministry.name} ministry room`;

        if (existingButton) {
          if (existingButton.textContent !== buttonLabel) existingButton.textContent = buttonLabel;
          if (existingButton.dataset.enterMinistryRoom !== ministry.id) {
            existingButton.dataset.enterMinistryRoom = ministry.id;
          }
          if (existingButton.dataset.openTargetType) delete existingButton.dataset.openTargetType;
          if (existingButton.getAttribute('aria-label') !== ariaLabel) {
            existingButton.setAttribute('aria-label', ariaLabel);
          }
          return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'organization-enter-ministry-room';
        button.dataset.enterMinistryRoom = ministry.id;
        button.textContent = buttonLabel;
        button.setAttribute('aria-label', ariaLabel);
        actions.appendChild(button);
      });
    }

    function scheduleMinistryEnhancement() {
      window.cancelAnimationFrame(enhancementFrame);
      enhancementFrame = window.requestAnimationFrame(() => {
        enhancementFrame = window.requestAnimationFrame(enhanceMinistryCards);
      });
    }

    function syncOrganizationSection(section) {
      if (!section || section === 'home') return;

      window.cancelAnimationFrame(syncFrame);
      syncFrame = window.requestAnimationFrame(() => {
        const targetButton = [...host.querySelectorAll('.organization-section-nav button')]
          .find((button) => normalizeSectionLabel(button.textContent) === section);

        if (targetButton && !targetButton.classList.contains('is-active')) {
          targetButton.click();
        }

        if (section === 'ministries') scheduleMinistryEnhancement();
      });
    }

    function handlePrimaryNavigation(event) {
      const button = event.target.closest('.church-workspace-primary-nav > button');
      if (!button || !shell?.contains(button)) return;
      syncOrganizationSection(normalizeSectionLabel(button.textContent));
    }

    function handleMinistryRoomClick(event) {
      const button = event.target.closest('[data-enter-ministry-room]');
      if (!button || !host.contains(button)) return;

      const ministryId = button.dataset.enterMinistryRoom;
      const isJoined = (workspace?.currentMember?.ministryIds || []).includes(ministryId);
      if (isJoined) onOpenMinistry(ministryId);
    }

    shell?.addEventListener('click', handlePrimaryNavigation);
    host.addEventListener('click', handleMinistryRoomClick);

    const activeButton = shell?.querySelector('.church-workspace-primary-nav > button.is-active');
    syncOrganizationSection(normalizeSectionLabel(activeButton?.textContent));

    return () => {
      window.cancelAnimationFrame(syncFrame);
      window.cancelAnimationFrame(enhancementFrame);
      shell?.removeEventListener('click', handlePrimaryNavigation);
      host.removeEventListener('click', handleMinistryRoomClick);
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
        <nav className="bottom-nav unified-bottom-nav" aria-label="Main navigation">
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
              className={id === 'church' ? 'active' : ''}
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
