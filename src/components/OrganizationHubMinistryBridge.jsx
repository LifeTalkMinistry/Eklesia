import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import OrganizationHub from './OrganizationHub.jsx';
import './PulseAccessGate.css';

function getLegacyViewStorageKey(organizationId) {
  return `ekklesia-pulse-beta-view:${organizationId || 'church'}`;
}

function getPulseCodeStorageKey(organizationId) {
  return `ekklesia-church-pulse-code:${organizationId || 'church'}`;
}

function normalizeSectionLabel(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeAccessCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function generatePulseAccessCode() {
  return `PULSE${Math.floor(1000 + Math.random() * 9000)}`;
}

function restorePulseAccessCode(organizationId) {
  if (typeof window === 'undefined') return 'PULSE1';

  try {
    const stored = normalizeAccessCode(window.localStorage.getItem(getPulseCodeStorageKey(organizationId)));
    if (stored) return stored;

    const initialCode = 'PULSE1';
    window.localStorage.setItem(getPulseCodeStorageKey(organizationId), initialCode);
    return initialCode;
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore the Church Pulse access code.', error);
    return 'PULSE1';
  }
}

function CodeAccessDialog({
  eyebrow,
  title,
  description,
  label,
  placeholder,
  entry,
  error,
  submitLabel,
  onEntryChange,
  onSubmit,
  onClose,
  children,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="pulse-access-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="pulse-access-dialog" role="dialog" aria-modal="true" aria-labelledby="code-access-title">
        <div className="pulse-access-heading">
          <div>
            <p className="dashboard-eyebrow">{eyebrow}</p>
            <h2 id="code-access-title">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close access code dialog">×</button>
        </div>

        <p className="pulse-access-copy">{description}</p>

        <form className="pulse-access-form" onSubmit={onSubmit}>
          <label htmlFor="workspace-access-code">{label}</label>
          <input
            ref={inputRef}
            id="workspace-access-code"
            value={entry}
            onChange={(event) => onEntryChange(normalizeAccessCode(event.target.value))}
            placeholder={placeholder}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck="false"
            required
          />
          {error ? <p className="pulse-access-error" role="alert">{error}</p> : null}
          <div className="pulse-access-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
            <button className="primary-button" type="submit" disabled={!entry}>{submitLabel}</button>
          </div>
        </form>

        {children}
      </section>
    </div>
  );
}

export default function OrganizationHubMinistryBridge({
  workspace,
  onOpenMinistry,
  onOpenGroup,
  onNavigateApp,
  organization,
  ...props
}) {
  const hostRef = useRef(null);
  const pulseUnlockedRef = useRef(false);
  const pendingPulseButtonRef = useRef(null);

  const [pulseCode, setPulseCode] = useState(() => restorePulseAccessCode(organization?.id));
  const [pulseUnlocked, setPulseUnlocked] = useState(false);
  const [showPulseGate, setShowPulseGate] = useState(false);
  const [pulseEntry, setPulseEntry] = useState('');
  const [pulseError, setPulseError] = useState('');
  const [pulseAdminMessage, setPulseAdminMessage] = useState('');

  const [ministryEntry, setMinistryEntry] = useState({ ministryId: '', code: '', error: '' });

  const currentRole = workspace?.currentMember?.organizationRole || 'Church Member';
  const isOrganizationManager = ['Organization Owner', 'Organization Admin'].includes(currentRole);
  const activeMinistry = (workspace?.ministries || []).find((ministry) => ministry.id === ministryEntry.ministryId) || null;
  const joinedGroupIds = new Set(workspace?.currentMember?.groupIds || []);
  const connectedJoinedGroup = activeMinistry
    ? (workspace?.groups || []).find((group) => (
      group.connectedMinistryId === activeMinistry.id && joinedGroupIds.has(group.id)
    )) || null
    : null;

  useEffect(() => {
    const nextCode = restorePulseAccessCode(organization?.id);
    setPulseCode(nextCode);
    setPulseUnlocked(false);
    pulseUnlockedRef.current = false;
    setShowPulseGate(false);
    setPulseEntry('');
    setPulseError('');
    setPulseAdminMessage('');
    setMinistryEntry({ ministryId: '', code: '', error: '' });
  }, [organization?.id]);

  useEffect(() => {
    pulseUnlockedRef.current = pulseUnlocked;
  }, [pulseUnlocked]);

  useEffect(() => {
    if (!showPulseGate && !ministryEntry.ministryId) return undefined;

    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      setShowPulseGate(false);
      setPulseEntry('');
      setPulseError('');
      setPulseAdminMessage('');
      setMinistryEntry({ ministryId: '', code: '', error: '' });
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showPulseGate, ministryEntry.ministryId]);

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
        const originalLabel = button.dataset.betaNativeSectionLabel || button.dataset.betaOriginalSectionLabel;
        if (originalLabel && button.textContent.trim() !== originalLabel) button.textContent = originalLabel;
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
    let ministryFrame = 0;
    let ministryTimer = 0;
    let ministryAttempt = 0;
    let groupFrame = 0;
    let groupTimer = 0;
    let groupAttempt = 0;

    function enhanceMinistryCards() {
      const joinedIds = new Set(workspace?.currentMember?.ministryIds || []);
      const ministryCards = [...host.querySelectorAll('.organization-ministry-card')];
      let expectedButtons = 0;
      let readyButtons = 0;

      ministryCards.forEach((card, index) => {
        const ministry = workspace?.ministries?.[index];
        const actions = card.querySelector('.organization-inline-actions');
        if (!ministry || !actions) return;

        const existingButton = actions.querySelector('[data-enter-ministry-room]');
        const cardShowsMembership = Boolean(card.querySelector('.organization-membership-chip'));
        const joined = joinedIds.has(ministry.id) || cardShowsMembership;

        if (!joined) {
          existingButton?.remove();
          return;
        }

        expectedButtons += 1;
        const buttonLabel = 'Enter Ministry Room';
        const ariaLabel = `Enter ${ministry.name} ministry room`;

        if (existingButton) {
          if (existingButton.textContent !== buttonLabel) existingButton.textContent = buttonLabel;
          existingButton.dataset.enterMinistryRoom = ministry.id;
          if (existingButton.getAttribute('aria-label') !== ariaLabel) existingButton.setAttribute('aria-label', ariaLabel);
          readyButtons += 1;
          return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'organization-enter-ministry-room';
        button.dataset.enterMinistryRoom = ministry.id;
        button.textContent = buttonLabel;
        button.setAttribute('aria-label', ariaLabel);
        actions.appendChild(button);
        readyButtons += 1;
      });

      return ministryCards.length > 0 && readyButtons === expectedButtons;
    }

    function enhanceGroupCards() {
      const joinedIds = new Set(workspace?.currentMember?.groupIds || []);
      const groupCards = [...host.querySelectorAll('.organization-group-card')];
      let expectedButtons = 0;
      let readyButtons = 0;

      groupCards.forEach((card, index) => {
        const group = workspace?.groups?.[index];
        if (!group) return;

        const existingButton = card.querySelector('[data-open-group-room]');
        const cardShowsMembership = Boolean(card.querySelector('.organization-membership-chip'));
        const joined = joinedIds.has(group.id) || cardShowsMembership;

        if (!joined) {
          existingButton?.remove();
          return;
        }

        expectedButtons += 1;
        const buttonLabel = 'Open Group';
        const ariaLabel = `Open ${group.name} group`;

        if (existingButton) {
          if (existingButton.textContent !== buttonLabel) existingButton.textContent = buttonLabel;
          existingButton.dataset.openGroupRoom = group.id;
          if (existingButton.getAttribute('aria-label') !== ariaLabel) existingButton.setAttribute('aria-label', ariaLabel);
          readyButtons += 1;
          return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'organization-enter-ministry-room organization-open-group-room';
        button.dataset.openGroupRoom = group.id;
        button.textContent = buttonLabel;
        button.setAttribute('aria-label', ariaLabel);

        const codeControls = card.querySelector('.organization-group-code-controls');
        if (codeControls) card.insertBefore(button, codeControls);
        else card.appendChild(button);
        readyButtons += 1;
      });

      return groupCards.length > 0 && readyButtons === expectedButtons;
    }

    function scheduleEnhancement(kind) {
      const isMinistry = kind === 'ministries';

      if (isMinistry) {
        window.cancelAnimationFrame(ministryFrame);
        window.clearTimeout(ministryTimer);
        ministryAttempt = 0;
      } else {
        window.cancelAnimationFrame(groupFrame);
        window.clearTimeout(groupTimer);
        groupAttempt = 0;
      }

      function attempt() {
        const run = () => {
          const attemptNumber = isMinistry ? ++ministryAttempt : ++groupAttempt;
          const complete = isMinistry ? enhanceMinistryCards() : enhanceGroupCards();
          if (!complete && attemptNumber < 12) {
            const timer = window.setTimeout(attempt, 40);
            if (isMinistry) ministryTimer = timer;
            else groupTimer = timer;
          }
        };

        const frame = window.requestAnimationFrame(run);
        if (isMinistry) ministryFrame = frame;
        else groupFrame = frame;
      }

      attempt();
    }

    function syncOrganizationSection(section) {
      if (!section || section === 'home') return;

      window.cancelAnimationFrame(syncFrame);
      syncFrame = window.requestAnimationFrame(() => {
        const targetButton = [...host.querySelectorAll('.organization-section-nav button')]
          .find((button) => normalizeSectionLabel(button.textContent) === section);

        if (targetButton && !targetButton.classList.contains('is-active')) targetButton.click();
        if (section === 'ministries' || section === 'groups') scheduleEnhancement(section);
      });
    }

    function handlePulseGateCapture(event) {
      const button = event.target.closest('.church-workspace-primary-nav > button, .organization-section-nav > button');
      if (!button || !shell?.contains(button)) return;

      const section = normalizeSectionLabel(button.textContent);
      if (section !== 'pulse') {
        if (pulseUnlockedRef.current) {
          pulseUnlockedRef.current = false;
          setPulseUnlocked(false);
        }
        return;
      }

      if (pulseUnlockedRef.current) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

      pendingPulseButtonRef.current = [...shell.querySelectorAll('.church-workspace-primary-nav > button')]
        .find((candidate) => normalizeSectionLabel(candidate.textContent) === 'pulse') || button;
      setPulseEntry('');
      setPulseError('');
      setPulseAdminMessage('');
      setShowPulseGate(true);
    }

    function handleSectionNavigation(event) {
      const button = event.target.closest('.church-workspace-primary-nav > button, .organization-section-nav > button');
      if (!button || !shell?.contains(button)) return;

      const section = normalizeSectionLabel(button.textContent);
      if (button.closest('.church-workspace-primary-nav')) syncOrganizationSection(section);
      else if (section === 'ministries' || section === 'groups') scheduleEnhancement(section);
    }

    function handleMinistryRoomClick(event) {
      const button = event.target.closest('[data-enter-ministry-room]');
      if (!button || !host.contains(button)) return;

      event.preventDefault();
      event.stopPropagation();
      const ministryId = button.dataset.enterMinistryRoom;
      if (!ministryId) return;

      setMinistryEntry({ ministryId, code: '', error: '' });
    }

    function handleGroupRoomClick(event) {
      const button = event.target.closest('[data-open-group-room]');
      if (!button || !host.contains(button)) return;

      const groupId = button.dataset.openGroupRoom;
      if (groupId) onOpenGroup?.(groupId);
    }

    shell?.addEventListener('click', handlePulseGateCapture, true);
    shell?.addEventListener('click', handleSectionNavigation);
    host.addEventListener('click', handleMinistryRoomClick);
    host.addEventListener('click', handleGroupRoomClick);

    const activeButton = shell?.querySelector('.church-workspace-primary-nav > button.is-active');
    syncOrganizationSection(normalizeSectionLabel(activeButton?.textContent));

    return () => {
      window.cancelAnimationFrame(syncFrame);
      window.cancelAnimationFrame(ministryFrame);
      window.clearTimeout(ministryTimer);
      window.cancelAnimationFrame(groupFrame);
      window.clearTimeout(groupTimer);
      shell?.removeEventListener('click', handlePulseGateCapture, true);
      shell?.removeEventListener('click', handleSectionNavigation);
      host.removeEventListener('click', handleMinistryRoomClick);
      host.removeEventListener('click', handleGroupRoomClick);
    };
  }, [workspace, onOpenGroup]);

  function verifyMinistryEntry(event) {
    event.preventDefault();
    if (!activeMinistry) return;

    if (normalizeAccessCode(ministryEntry.code) !== normalizeAccessCode(activeMinistry.code)) {
      setMinistryEntry((current) => ({
        ...current,
        error: 'That code does not match this ministry. Ask the ministry leader for the current code.',
      }));
      return;
    }

    setMinistryEntry({ ministryId: '', code: '', error: '' });

    if (connectedJoinedGroup) {
      onOpenGroup?.(connectedJoinedGroup.id);
      return;
    }

    onOpenMinistry?.(activeMinistry.id);
  }

  function verifyPulseAccess(event) {
    event.preventDefault();
    if (normalizeAccessCode(pulseEntry) !== normalizeAccessCode(pulseCode)) {
      setPulseError('That code does not match the current Church Pulse code. Ask a church administrator for the latest code.');
      return;
    }

    pulseUnlockedRef.current = true;
    setPulseUnlocked(true);
    setPulseError('');
    setShowPulseGate(false);

    const pulseButton = pendingPulseButtonRef.current;
    pendingPulseButtonRef.current = null;
    window.requestAnimationFrame(() => pulseButton?.click());
  }

  async function copyPulseCode() {
    try {
      await navigator.clipboard.writeText(pulseCode);
      setPulseAdminMessage(`Code ${pulseCode} copied.`);
    } catch (error) {
      console.warn('Church Pulse code copy failed.', error);
      setPulseAdminMessage(`Current code: ${pulseCode}`);
    }
  }

  function rotatePulseCode() {
    if (!isOrganizationManager) return;

    const nextCode = generatePulseAccessCode();
    try {
      window.localStorage.setItem(getPulseCodeStorageKey(organization?.id), nextCode);
    } catch (error) {
      console.warn('Ekklesia Pulse could not save the rotated Church Pulse code.', error);
    }

    pulseUnlockedRef.current = false;
    setPulseUnlocked(false);
    setPulseCode(nextCode);
    setPulseEntry('');
    setPulseError('');
    setPulseAdminMessage('A new Church Pulse code was created. The previous code no longer opens Pulse on this device.');
  }

  function closePulseGate() {
    pendingPulseButtonRef.current = null;
    setShowPulseGate(false);
    setPulseEntry('');
    setPulseError('');
    setPulseAdminMessage('');
  }

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
        <>
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
          </nav>

          {ministryEntry.ministryId && activeMinistry ? (
            <CodeAccessDialog
              eyebrow="Ministry room access"
              title={`Enter ${activeMinistry.name}`}
              description={connectedJoinedGroup
                ? `Enter the ministry code once. After verification, you will go directly to ${connectedJoinedGroup.name}.`
                : 'Enter the ministry code to open this ministry room.'}
              label="Ministry code"
              placeholder="Enter ministry code"
              entry={ministryEntry.code}
              error={ministryEntry.error}
              submitLabel={connectedJoinedGroup ? 'Open Group' : 'Open Ministry Room'}
              onEntryChange={(value) => setMinistryEntry((current) => ({ ...current, code: value, error: '' }))}
              onSubmit={verifyMinistryEntry}
              onClose={() => setMinistryEntry({ ministryId: '', code: '', error: '' })}
            />
          ) : null}

          {showPulseGate ? (
            <CodeAccessDialog
              eyebrow="Restricted church insight"
              title="Enter the Church Pulse code"
              description={`Pulse contains organization-wide rhythm and care signals for ${organization?.name || 'this church'}. The tab is visible to everyone, but its content opens only with the separate code provided by a church administrator.`}
              label="Church Pulse code"
              placeholder="Enter Pulse code"
              entry={pulseEntry}
              error={pulseError}
              submitLabel="Open Pulse"
              onEntryChange={(value) => {
                setPulseEntry(value);
                setPulseError('');
              }}
              onSubmit={verifyPulseAccess}
              onClose={closePulseGate}
            >
              {isOrganizationManager ? (
                <aside className="pulse-access-admin" aria-label="Church Pulse administrator controls">
                  <div>
                    <p className="dashboard-eyebrow">Administrator only</p>
                    <strong>Church Pulse access code</strong>
                    <small>Share this only with people approved to view church-wide rhythm signals.</small>
                  </div>
                  <code>{pulseCode}</code>
                  <div className="pulse-access-admin-actions">
                    <button type="button" onClick={copyPulseCode}>Copy</button>
                    <button type="button" onClick={rotatePulseCode}>Rotate</button>
                  </div>
                  {pulseAdminMessage ? <p className="pulse-access-admin-message" role="status">{pulseAdminMessage}</p> : null}
                </aside>
              ) : null}
              <p className="pulse-access-prototype-note">Local prototype note: this code is stored on this device and is not production-grade security.</p>
            </CodeAccessDialog>
          ) : null}
        </>,
        portalTarget,
      ) : null}
    </>
  );
}
