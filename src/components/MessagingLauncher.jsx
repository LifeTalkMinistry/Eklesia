import { useEffect, useRef, useState } from 'react';
import { mockEcosystems } from '../data/mockEcosystems.js';
import { getJoinedEcosystem } from '../services/ecosystemService.js';
import {
  getPrototypeUnreadCount,
  MESSAGING_UPDATED_EVENT,
} from '../services/messagingService.js';
import { getOrganizationPrototypeState } from '../services/organizationPrototypeService.js';
import MessagingCenter, { MessageBubbleIcon } from './MessagingCenter.jsx';

function getMemberRelationship(member, workspace) {
  const currentMember = workspace?.currentMember || {};
  const groups = Array.isArray(workspace?.groups) ? workspace.groups : [];
  const currentGroupIds = new Set(Array.isArray(currentMember.groupIds) ? currentMember.groupIds : []);
  const sharedGroup = groups.find((group) => (
    currentGroupIds.has(group.id)
    && Array.isArray(group.memberIds)
    && group.memberIds.includes(member.id)
  ));

  if (sharedGroup) {
    return {
      label: sharedGroup.groupType === 'dgroup'
        ? `Same D-Group · ${sharedGroup.name}`
        : `Same group · ${sharedGroup.name}`,
      rank: 0,
    };
  }

  const roles = Array.isArray(member.roles) ? member.roles : [];
  const leaderRole = roles.find((role) => String(role?.role || '').includes('Leader'));
  if (leaderRole) {
    return {
      label: `${leaderRole.role}${leaderRole.scopeName ? ` · ${leaderRole.scopeName}` : ''}`,
      rank: 1,
    };
  }

  if (member.organizationRole && member.organizationRole !== 'Church Member') {
    return { label: member.organizationRole, rank: 2 };
  }

  return { label: 'Churchmate', rank: 3 };
}

function buildChurchmateDirectory(organization, workspace, currentUserName) {
  const members = Array.isArray(workspace?.members) ? workspace.members : [];
  const normalizedCurrentName = String(currentUserName || '').trim().toLowerCase();

  return members
    .filter((member) => (
      member?.id
      && member.id !== 'current-member'
      && String(member.name || '').trim().toLowerCase() !== normalizedCurrentName
    ))
    .map((member) => {
      const relationship = getMemberRelationship(member, workspace);
      const roleKeywords = (member.roles || []).flatMap((role) => [role.role, role.scopeName]);
      return {
        id: member.id,
        name: member.name || 'Church member',
        subtitle: relationship.label,
        rank: relationship.rank,
        searchText: [
          member.name,
          member.organizationRole,
          organization?.name,
          member.assignedDGroupId,
          ...roleKeywords,
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
    if (!open) return undefined;

    let active = true;
    setDirectoryLoading(true);

    async function loadDirectory() {
      try {
        const joined = await getJoinedEcosystem();
        const organization = joined.ok && joined.data ? joined.data : mockEcosystems[0];
        const workspace = organization ? getOrganizationPrototypeState(organization) : null;
        if (!active) return;
        setChurchName(organization?.name || 'your church');
        setChurchmates(buildChurchmateDirectory(organization, workspace, currentUserName));
      } catch (error) {
        console.warn('Ekklesia Pulse could not prepare the churchmate directory.', error);
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
