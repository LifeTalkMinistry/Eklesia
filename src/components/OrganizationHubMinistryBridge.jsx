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

function PulseAccessDialog({
  organizationName,
  code,
  entry,
  error,
  adminMessage,
  isOrganizationManager,
  onEntryChange,
  onSubmit,
  onCopy,
  onRotate,
  onClose,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="pulse-access-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="pulse-access-dialog" role="dialog" aria-modal="true" aria-labelledby="pulse-access-title">
        <div className="pulse-access-heading">
          <div>
            <p className="dashboard-eyebrow">Restricted church insight</p>
            <h2 id="pulse-access-title">Enter the Church Pulse code</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Church Pulse access">×</button>
        </div>

        <p className="pulse-access-copy">
          Pulse contains organization-wide rhythm and care signals for {organizationName || 'this church'}. The tab is visible to everyone, but its content opens only with the separate code provided by a church administrator.
        </p>

        <form className="pulse-access-form" onSubmit={onSubmit}>
          <label htmlFor="church-pulse-access-code">Church Pulse code</label>
          <input
            ref={inputRef}
            id="church-pulse-access-code"
            value={entry}
            onChange={(event) => onEntryChange(normalizeAccessCode(event.target.value))}
            placeholder="Enter Pulse code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck="false"
            required
          />
          {error ? <p className="pulse-access-error" role="alert">{error}</p> : null}
          <div className="pulse-access-actions">
            <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
            <button className="primary-button" type="submit" disabled={!entry}>Open Pulse</button>
          </div>
        </form>

        {isOrganizationManager ? (
          <aside className="pulse-access-admin" aria-label="Church Pulse administrator controls">
            <div>
              <p className="dashboard-eyebrow">Administrator only</p>
              <strong>Church Pulse access code</strong>
              <small>Share this only with people approved to view church-wide rhythm signals.</small>
            </div>
            <code>{code}</code>
            <div className="pulse-access-admin-actions">
              <button type="button" onClick={onCopy}>Copy</button>
              <button type="button" onClick={onRotate}>Rotate</button>
            </div>
            {adminMessage ? <p className="pulse-access-admin-message" role="status">{adminMessage}</p> : null}
          </aside>
        ) : null}

        <p className="pulse-access-prototype-note">
          Local prototype note: this code is stored on this device and is not production-grade security.
        </p>
      </section>
    </div>
  );
}

export default function OrganizationHubMinistryBridge({
  workspace,
  onOpenMinistry,
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

  const currentRole = workspace?.currentMember?.organizationRole || 'Church Member';
  const isOrganizationManager = ['Organization Owner', 'Organization Admin'].includes(currentRole);

  useEffect(() => {
    const nextCode = restorePulseAccessCode(organization?.id);
    setPulseCode(nextCode);
    setPulseUnlocked(false);
    pulseUnlockedRef.current = false;
    setShowPulseGate(false);
    setPulseEntry('');
    setPulseError('');
    setPulseAdminMessage('');
  }, [organization?.id]);

  useEffect(() => {
    pulseUnlockedRef.current = pulseUnlocked;
  }, [pulseUnlocked]);

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

    shell?.addEventListener('click', handlePulseGateCapture, true);
    shell?.addEventListener('click', handlePrimaryNavigation);
    host.addEventListener('click', handleMinistryRoomClick);

    const activeButton = shell?.querySelector('.church-workspace-primary-nav > button.is-active');
    syncOrganizationSection(normalizeSectionLabel(activeButton?.textContent));

    return () => {
      window.cancelAnimationFrame(syncFrame);
      window.cancelAnimationFrame(enhancementFrame);
      shell?.removeEventListener('click', handlePulseGateCapture, true);
      shell?.removeEventListener('click', handlePrimaryNavigation);
      host.removeEventListener('click', handleMinistryRoomClick);
    };
  }, [workspace, onOpenMinistry]);

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

          {showPulseGate ? (
            <PulseAccessDialog
              organizationName={organization?.name}
              code={pulseCode}
              entry={pulseEntry}
              error={pulseError}
              adminMessage={pulseAdminMessage}
              isOrganizationManager={isOrganizationManager}
              onEntryChange={(value) => {
                setPulseEntry(value);
                setPulseError('');
              }}
              onSubmit={verifyPulseAccess}
              onCopy={copyPulseCode}
              onRotate={rotatePulseCode}
              onClose={closePulseGate}
            />
          ) : null}
        </>,
        portalTarget,
      ) : null}
    </>
  );
}
