import { useEffect, useRef, useState } from 'react';
import { getBackendAccountId } from '../services/backendSessionService.js';
import { getEcosystemMembers, getJoinedEcosystem } from '../services/ecosystemService.js';
import {
  getPrototypeUnreadCount,
  MESSAGING_UPDATED_EVENT,
  synchronizeMessaging,
} from '../services/messagingService.js';
import MessagingCenter, { MessageBubbleIcon } from './MessagingCenter.jsx';

function normalizedName(value) {
  return String(value || '').trim().toLowerCase();
}

function isConnectedMember(member) {
  return /^\d+$/.test(String(member?.id || '')) && !member?.prototype;
}

function memberSubtitle(member) {
  const role = String(
    member?.organizationRole
    || member?.membershipRole
    || member?.role
    || '',
  ).trim();
  const ministry = String(member?.ministryName || member?.ministry || '').trim();
  const group = String(member?.dGroupName || member?.groupName || '').trim();

  if (role && role.toLowerCase() !== 'member' && role.toLowerCase() !== 'church member') {
    return role;
  }
  if (ministry) return ministry;
  if (group) return group;
  return 'Connected churchmate';
}

function buildConnectedChurchmateDirectory(
  organization,
  currentUserName,
  currentUserId,
  availableMembers = [],
) {
  const normalizedCurrentName = normalizedName(currentUserName);

  return availableMembers
    .filter(isConnectedMember)
    .filter((member) => String(member.id) !== String(currentUserId || ''))
    .filter((member) => normalizedName(member.name) !== normalizedCurrentName)
    .map((member) => {
      const subtitle = memberSubtitle(member);
      return {
        id: `backend-member-${member.id}`,
        callTargetId: String(member.id),
        name: String(member.name || 'Church member'),
        subtitle,
        rank: subtitle === 'Connected churchmate' ? 2 : 1,
        searchText: [
          member.name,
          subtitle,
          member.organizationRole,
          member.membershipRole,
          member.role,
          member.ministryName,
          member.ministry,
          member.dGroupName,
          member.groupName,
          organization?.name,
        ].filter(Boolean).join(' ').toLowerCase(),
      };
    })
    .sort((first, second) => first.rank - second.rank || first.name.localeCompare(second.name));
}

export default function MessagingLauncher({ currentUserName = 'You' }) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(getPrototypeUnreadCount);
  const [churchmates, setChurchmates] = useState([]);
  const [churchName, setChurchName] = useState('');
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const triggerRef = useRef(null);

  useEffect(() => {
    function handleUpdate() {
      setUnreadCount(getPrototypeUnreadCount());
    }
    window.addEventListener(MESSAGING_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(MESSAGING_UPDATED_EVENT, handleUpdate);
  }, []);

  useEffect(() => {
    function refreshInbox() {
      if (document.visibilityState === 'visible') void synchronizeMessaging();
    }

    refreshInbox();
    const poll = window.setInterval(refreshInbox, 15_000);
    document.addEventListener('visibilitychange', refreshInbox);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', refreshInbox);
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    let active = true;
    setDirectoryLoading(true);

    async function loadDirectory() {
      try {
        const joined = await getJoinedEcosystem();
        const organization = joined.ok && joined.data?.backendConnected ? joined.data : null;

        if (!organization) {
          if (active) {
            setChurchName(joined.data?.name || 'your church');
            setChurchmates([]);
          }
          return;
        }

        const memberResult = await getEcosystemMembers(organization.id);
        const availableMembers = memberResult.ok && Array.isArray(memberResult.data)
          ? memberResult.data
          : [];

        if (!active) return;
        setChurchName(organization.name || 'your church');
        setChurchmates(buildConnectedChurchmateDirectory(
          organization,
          currentUserName,
          getBackendAccountId(),
          availableMembers,
        ));
      } catch (error) {
        console.warn('Ekklesia Pulse could not prepare the connected churchmate directory.', error);
        if (active) {
          setChurchName('your church');
          setChurchmates([]);
        }
      } finally {
        if (active) setDirectoryLoading(false);
      }
    }

    loadDirectory();
    return () => {
      active = false;
    };
  }, [open, currentUserName]);

  return (
    <>
      <button
        ref={triggerRef}
        className="notification-button message-inbox-trigger"
        type="button"
        aria-label={unreadCount ? `Messages, ${unreadCount} unread` : 'Messages'}
        onClick={() => setOpen(true)}
      >
        <MessageBubbleIcon className="message-inbox-glyph" />
        {unreadCount ? <span className="message-unread-badge">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
      </button>
      <MessagingCenter
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        currentUserName={currentUserName}
        contacts={churchmates}
        churchName={churchName}
        directoryLoading={directoryLoading}
      />
    </>
  );
}
