import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import OrganizationHub from './OrganizationHub.jsx';
import './PulseAccessGate.css';

function getLegacyViewStorageKey(organizationId) {
  return `ekklesia-pulse-beta-view:${organizationId || 'church'}`;
}

function getAdminCodeStorageKey(organizationId) {
  return `ekklesia-church-admin-code:${organizationId || 'church'}`;
}

function getLegacyPulseCodeStorageKey(organizationId) {
  return `ekklesia-church-pulse-code:${organizationId || 'church'}`;
}

function normalizeSectionLabel(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeAccessCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function generateAdminAccessCode() {
  return `ADMIN${Math.floor(1000 + Math.random() * 9000)}`;
}

function restoreAdminAccessCode(organizationId) {
  if (typeof window === 'undefined') return 'ADMIN1';

  try {
    const storageKey = getAdminCodeStorageKey(organizationId);
    const stored = normalizeAccessCode(window.localStorage.getItem(storageKey));
    if (stored) return stored;

    const legacyCode = normalizeAccessCode(
      window.localStorage.getItem(getLegacyPulseCodeStorageKey(organizationId)),
    );
    const initialCode = legacyCode || 'ADMIN1';
    window.localStorage.setItem(storageKey, initialCode);
    return initialCode;
  } catch (error) {
    console.warn('Ekklesia Pulse could not restore the church Admin access code.', error);
    return 'ADMIN1';
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
    <div
      className="pulse-access-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="pulse-access-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-code-access-title"
      >
        <div className="pulse-access-heading">
          <div>
            <p className="dashboard-eyebrow">{eyebrow}</p>
            <h2 id="workspace-code-access-title">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close access-code dialog">×</button>
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
  activeSection,
  onOpenMinistry,
  onOpenGroup,
  onNavigateApp,
  organization,
  ...props
}) {
  const hostRef = useRef(null);
  const adminUnlockedRef = useRef(false);
  const pendingAdminButtonRef = useRef(null);

  const [adminCode, setAdminCode] = useState(() => restoreAdminAccessCode(organization?.id));
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminActive, setAdminActive] = useState(false);
  const [adminSection, setAdminSection] = useState('people');
  const [showAdminGate, setShowAdminGate] = useState(false);
  const [adminEntry, setAdminEntry] = useState('');
  const [adminError, setAdminError] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [ministryEntry, setMinistryEntry] = useState({ ministryId: '', code: '', error: '' });

  const currentRole = workspace?.currentMember?.organizationRole || 'Church Member';
  const isOrganizationManager = ['Organization Owner', 'Organization Admin'].includes(currentRole);
  const activeMinistry = (workspace?.ministries || [])
    .find((ministry) => ministry.id === ministryEntry.ministryId) || null;
  const joinedGroupIds = new Set(workspace?.currentMember?.groupIds || []);
  const connectedJoinedGroup = activeMinistry
    ? (workspace?.groups || []).find((group) => (
      group.connectedMinistryId === activeMinistry.id && joinedGroupIds.has(group.id)
    )) || null
    : null;

  useEffect(() => {
    const nextCode = restoreAdminAccessCode(organization?.id);
    setAdminCode(nextCode);
    setAdminUnlocked(false);
    adminUnlockedRef.current = false;
    setAdminActive(false);
    setAdminSection('people');
    setShowAdminGate(false);
    setAdminEntry('');
    setAdminError('');
    setAdminMessage('');
    setMinistryEntry({ ministryId: '', code: '', error: '' });
  }, [organization?.id]);

  useEffect(() => {
    adminUnlockedRef.current = adminUnlocked;
  }, [adminUnlocked]);

  useEffect(() => {
    if (activeSection === 'admin') return;
    adminUnlockedRef.current = false;
    setAdminUnlocked(false);
    setAdminActive(false);
  }, [activeSection]);

  useEffect(() => {
    if (!showAdminGate && !ministryEntry.ministryId) return undefined;

    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      setShowAdminGate(false);
      setAdminEntry('');
      setAdminError('');
      setAdminMessage('');
      setMinistryEntry({ ministryId: '', code: '', error: '' });
    }

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showAdminGate, ministryEntry.ministryId]);

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

      shell.querySelectorAll('.church-workspace-primary-nav > button, .organization-section-nav > button')
        .forEach((button) => {
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
    let adminFrame = 0;
    let ministryFrame = 0;
    let ministryTimer = 0;
    let groupFrame = 0;
    let groupTimer = 0;

    function enhanceMinistryCards() {
      const joinedIds = new Set(workspace?.currentMember?.ministryIds || []);
      const ministryCards = [...host.querySelectorAll('.organization-ministry-card')];

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

        const buttonLabel = 'Enter Ministry Room';
        const ariaLabel = `Enter ${ministry.name} ministry room`;

        if (existingButton) {
          existingButton.textContent = buttonLabel;
          existingButton.dataset.enterMinistryRoom = ministry.id;
          existingButton.setAttribute('aria-label', ariaLabel);
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

    function enhanceGroupCards() {
      const joinedIds = new Set(workspace?.currentMember?.groupIds || []);
      const groupCards = [...host.querySelectorAll('.organization-group-card')];

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

        const buttonLabel = 'Open Group';
        const ariaLabel = `Open ${group.name} group`;

        if (existingButton) {
          existingButton.textContent = buttonLabel;
          existingButton.dataset.openGroupRoom = group.id;
          existingButton.setAttribute('aria-label', ariaLabel);
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
      });
    }

    function scheduleEnhancement(kind) {
      const isMinistry = kind === 'ministries';
      const runEnhancement = isMinistry ? enhanceMinistryCards : enhanceGroupCards;

      if (isMinistry) {
        window.cancelAnimationFrame(ministryFrame);
        window.clearTimeout(ministryTimer);
      } else {
        window.cancelAnimationFrame(groupFrame);
        window.clearTimeout(groupTimer);
      }

      let attempt = 0;
      const maximumAttempts = isMinistry ? 10 : 6;

      function run() {
        const frame = window.requestAnimationFrame(() => {
          runEnhancement();
          attempt += 1;
          if (attempt < maximumAttempts) {
            const timer = window.setTimeout(run, 45);
            if (isMinistry) ministryTimer = timer;
            else groupTimer = timer;
          }
        });

        if (isMinistry) ministryFrame = frame;
        else groupFrame = frame;
      }

      run();
    }

    function clickOrganizationSection(section) {
      const targetButton = [...host.querySelectorAll('.organization-section-nav button')]
        .find((button) => normalizeSectionLabel(button.textContent) === section);
      if (targetButton && !targetButton.classList.contains('is-active')) targetButton.click();
    }

    function syncOrganizationSection(section) {
      if (!section || section === 'home' || section === 'admin') return;

      window.cancelAnimationFrame(syncFrame);
      syncFrame = window.requestAnimationFrame(() => {
        clickOrganizationSection(section);
        if (section === 'ministries' || section === 'groups') scheduleEnhancement(section);
      });
    }

    function syncAdminSection(section) {
      window.cancelAnimationFrame(adminFrame);
      adminFrame = window.requestAnimationFrame(() => {
        clickOrganizationSection(section);
        window.requestAnimationFrame(() => {
          const heading = host.querySelector('.organization-section-stack h3');
          if (heading) {
            heading.setAttribute('tabindex', '-1');
            heading.focus({ preventScroll: true });
          }
        });
      });
    }

    function handleAdminGateCapture(event) {
      const button = event.target.closest('.church-workspace-primary-nav > button');
      if (!button || !shell?.contains(button)) return;

      const section = normalizeSectionLabel(button.textContent);
      if (section !== 'admin') return;
      if (adminUnlockedRef.current) return;

      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();

      pendingAdminButtonRef.current = button;
      setAdminEntry('');
      setAdminError('');
      setAdminMessage('');
      setShowAdminGate(true);
    }

    function handleHostClick(event) {
      const ministryRoomButton = event.target.closest('[data-enter-ministry-room]');
      if (ministryRoomButton && host.contains(ministryRoomButton)) {
        event.preventDefault();
        event.stopPropagation();
        const ministryId = ministryRoomButton.dataset.enterMinistryRoom;
        if (ministryId) setMinistryEntry({ ministryId, code: '', error: '' });
        return;
      }

      const groupRoomButton = event.target.closest('[data-open-group-room]');
      if (groupRoomButton && host.contains(groupRoomButton)) {
        event.preventDefault();
        event.stopPropagation();
        const groupId = groupRoomButton.dataset.openGroupRoom;
        if (groupId) onOpenGroup?.(groupId);
        return;
      }

      const sectionButton = event.target.closest('.organization-section-nav > button');
      if (sectionButton && host.contains(sectionButton)) {
        const section = normalizeSectionLabel(sectionButton.textContent);
        if (section === 'ministries' || section === 'groups') scheduleEnhancement(section);
        return;
      }

      const ministrySummary = event.target.closest('.organization-ministry-summary');
      if (ministrySummary && host.contains(ministrySummary)) {
        scheduleEnhancement('ministries');
      }
    }

    shell?.addEventListener('click', handleAdminGateCapture, true);
    host.addEventListener('click', handleHostClick);

    if (activeSection === 'admin' && adminUnlockedRef.current) {
      setAdminActive(true);
      syncAdminSection(adminSection);
    } else {
      setAdminActive(false);
      syncOrganizationSection(activeSection);
    }

    return () => {
      window.cancelAnimationFrame(syncFrame);
      window.cancelAnimationFrame(adminFrame);
      window.cancelAnimationFrame(ministryFrame);
      window.clearTimeout(ministryTimer);
      window.cancelAnimationFrame(groupFrame);
      window.clearTimeout(groupTimer);
      shell?.removeEventListener('click', handleAdminGateCapture, true);
      host.removeEventListener('click', handleHostClick);
    };
  }, [workspace, onOpenGroup, activeSection, adminSection]);

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

  function verifyAdminAccess(event) {
    event.preventDefault();
    if (normalizeAccessCode(adminEntry) !== normalizeAccessCode(adminCode)) {
      setAdminError('That code does not match the current Admin code. Ask the organization administrator for the latest code.');
      return;
    }

    adminUnlockedRef.current = true;
    setAdminUnlocked(true);
    setAdminError('');
    setShowAdminGate(false);

    const adminButton = pendingAdminButtonRef.current;
    pendingAdminButtonRef.current = null;
    window.requestAnimationFrame(() => adminButton?.click());
  }

  async function copyAdminCode() {
    try {
      await navigator.clipboard.writeText(adminCode);
      setAdminMessage(`Code ${adminCode} copied.`);
    } catch (error) {
      console.warn('Church Admin code copy failed.', error);
      setAdminMessage(`Current code: ${adminCode}`);
    }
  }

  function rotateAdminCode() {
    if (!isOrganizationManager) return;

    const nextCode = generateAdminAccessCode();
    try {
      window.localStorage.setItem(getAdminCodeStorageKey(organization?.id), nextCode);
    } catch (error) {
      console.warn('Ekklesia Pulse could not save the rotated Admin code.', error);
    }

    adminUnlockedRef.current = false;
    setAdminUnlocked(false);
    setAdminCode(nextCode);
    setAdminEntry('');
    setAdminError('');
    setAdminMessage('A new Admin code was created. The previous code no longer opens Admin on this device.');
  }

  function closeAdminGate() {
    pendingAdminButtonRef.current = null;
    setShowAdminGate(false);
    setAdminEntry('');
    setAdminError('');
    setAdminMessage('');
  }

  function navigateUnifiedApp(section) {
    if (section === 'church') return;
    onNavigateApp?.(section);
  }

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <>
      <div ref={hostRef} className="organization-hub-ministry-bridge">
        {adminActive ? (
          <section className="organization-admin-shell" aria-label="Church administration">
            <div className="organization-admin-heading">
              <p className="dashboard-eyebrow">Church administration</p>
              <h3>Manage people and church-wide rhythm.</h3>
              <p>People controls and the Church Pulse are kept together inside this protected area.</p>
            </div>
            <nav className="organization-admin-subnav" aria-label="Admin sections">
              {[
                ['people', 'People'],
                ['pulse', 'Pulse'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={adminSection === id ? 'is-active' : ''}
                  aria-current={adminSection === id ? 'page' : undefined}
                  onClick={() => setAdminSection(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
          </section>
        ) : null}

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
              onEntryChange={(value) => setMinistryEntry((current) => ({
                ...current,
                code: value,
                error: '',
              }))}
              onSubmit={verifyMinistryEntry}
              onClose={() => setMinistryEntry({ ministryId: '', code: '', error: '' })}
            />
          ) : null}

          {showAdminGate ? (
            <CodeAccessDialog
              eyebrow="Restricted church administration"
              title="Enter the Admin access code"
              description={`Admin contains people and role management plus church-wide Pulse insights for ${organization?.name || 'this church'}. Enter the separate code provided by the organization administrator.`}
              label="Admin code"
              placeholder="Enter Admin code"
              entry={adminEntry}
              error={adminError}
              submitLabel="Open Admin"
              onEntryChange={(value) => {
                setAdminEntry(value);
                setAdminError('');
              }}
              onSubmit={verifyAdminAccess}
              onClose={closeAdminGate}
            >
              {isOrganizationManager ? (
                <aside className="pulse-access-admin" aria-label="Church administrator access controls">
                  <div>
                    <p className="dashboard-eyebrow">Administrator only</p>
                    <strong>Church Admin access code</strong>
                    <small>Share this only with people approved to manage members or view church-wide rhythm signals.</small>
                  </div>
                  <code>{adminCode}</code>
                  <div className="pulse-access-admin-actions">
                    <button type="button" onClick={copyAdminCode}>Copy</button>
                    <button type="button" onClick={rotateAdminCode}>Rotate</button>
                  </div>
                  {adminMessage ? (
                    <p className="pulse-access-admin-message" role="status">{adminMessage}</p>
                  ) : null}
                </aside>
              ) : null}
              <p className="pulse-access-prototype-note">
                Local prototype note: this code is stored on this device and is not production-grade security.
              </p>
            </CodeAccessDialog>
          ) : null}
        </>,
        portalTarget,
      ) : null}
    </>
  );
}
