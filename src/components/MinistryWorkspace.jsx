import { useMemo } from 'react';
import GroupWorkspace from './GroupWorkspace.jsx';

function resolveMinistryRoom(workspace, ministryId) {
  const connectedGroups = (workspace?.groups || []).filter((group) => (
    group.groupType !== 'dgroup' && group.connectedMinistryId === ministryId
  ));
  const joinedGroupIds = new Set(workspace?.currentMember?.groupIds || []);

  return connectedGroups.find((group) => joinedGroupIds.has(group.id))
    || connectedGroups[0]
    || null;
}

function provideMinistryRoomAccess(workspace, group) {
  if (!workspace || !group) return workspace;

  const existingGroupIds = workspace.currentMember?.groupIds || [];
  if (existingGroupIds.includes(group.id)) return workspace;

  return {
    ...workspace,
    currentMember: {
      ...(workspace.currentMember || {}),
      groupIds: [...new Set([...existingGroupIds, group.id])],
    },
  };
}

export default function MinistryWorkspace({ organization, workspace, ministry, profile, onBack }) {
  const room = useMemo(
    () => resolveMinistryRoom(workspace, ministry.id),
    [workspace, ministry.id],
  );

  const roomWorkspace = useMemo(
    () => provideMinistryRoomAccess(workspace, room),
    [workspace, room],
  );

  if (!room) {
    return (
      <section className="group-workspace" aria-labelledby="ministry-room-unavailable-title">
        <button className="group-workspace-back" type="button" onClick={onBack}>
          <span aria-hidden="true">←</span> Back to Ministries
        </button>
        <section className="group-workspace-panel">
          <p className="dashboard-eyebrow">Ministry room</p>
          <h2 id="ministry-room-unavailable-title">Room not connected yet</h2>
          <p>This ministry does not have a connected group workspace yet. Ask the ministry leader to connect its room.</p>
        </section>
      </section>
    );
  }

  return (
    <GroupWorkspace
      organization={organization}
      workspace={roomWorkspace}
      group={room}
      profile={profile}
      onBack={onBack}
    />
  );
}
