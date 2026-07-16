import { useEffect, useMemo, useState } from 'react';
import {
  getOrganizationPrototypeState,
  saveOrganizationPrototypeState,
} from '../services/organizationPrototypeService.js';
import './MemberConnections.css';

function uniqueMemberIds(values, validIds) {
  return [...new Set(Array.isArray(values) ? values : [])]
    .filter((memberId) => validIds.has(memberId));
}

function readConnectionState(organization, workspace) {
  const members = (workspace?.members || []).filter((member) => member.id !== 'current-member');
  const validIds = new Set(members.map((member) => member.id));
  const currentMember = workspace?.currentMember || {};
  const hasSavedConnections = Array.isArray(currentMember.connectionIds);
  const hasSavedCompanions = Array.isArray(currentMember.closeCompanionIds);
  const fallbackConnections = members.slice(0, 2).map((member) => member.id);
  const connectionIds = uniqueMemberIds(
    hasSavedConnections ? currentMember.connectionIds : fallbackConnections,
    validIds,
  );
  const closeCompanionIds = uniqueMemberIds(
    hasSavedCompanions ? currentMember.closeCompanionIds : connectionIds.slice(0, 1),
    new Set(connectionIds),
  );

  return {
    organizationId: organization?.id || '',
    connectionIds,
    closeCompanionIds,
  };
}

export default function MemberConnections({ organization, workspace }) {
  const [connectionState, setConnectionState] = useState(() => readConnectionState(organization, workspace));
  const [statusMessage, setStatusMessage] = useState('');

  const members = useMemo(
    () => (workspace?.members || []).filter((member) => member.id !== 'current-member'),
    [workspace],
  );

  useEffect(() => {
    setConnectionState(readConnectionState(organization, workspace));
  }, [organization?.id, workspace]);

  const connectionIds = new Set(connectionState.connectionIds);
  const closeCompanionIds = new Set(connectionState.closeCompanionIds);
  const connections = members.filter((member) => connectionIds.has(member.id));
  const suggestions = members.filter((member) => !connectionIds.has(member.id));

  function persistConnections(nextConnectionIds, nextCloseCompanionIds, message) {
    if (!organization?.id) return;

    const latestWorkspace = getOrganizationPrototypeState(organization);
    const validIds = new Set((latestWorkspace.members || [])
      .filter((member) => member.id !== 'current-member')
      .map((member) => member.id));
    const normalizedConnections = uniqueMemberIds(nextConnectionIds, validIds);
    const normalizedCompanions = uniqueMemberIds(
      nextCloseCompanionIds,
      new Set(normalizedConnections),
    );
    const nextWorkspace = {
      ...latestWorkspace,
      currentMember: {
        ...latestWorkspace.currentMember,
        connectionIds: normalizedConnections,
        closeCompanionIds: normalizedCompanions,
      },
    };
    const result = saveOrganizationPrototypeState(organization.id, nextWorkspace);

    setConnectionState({
      organizationId: organization.id,
      connectionIds: normalizedConnections,
      closeCompanionIds: normalizedCompanions,
    });
    setStatusMessage(result.ok
      ? message
      : result.error?.message || 'This connection change could not be saved.');
  }

  function addConnection(member) {
    persistConnections(
      [...connectionState.connectionIds, member.id],
      connectionState.closeCompanionIds,
      `${member.name} was added to your church connections.`,
    );
  }

  function removeConnection(member) {
    persistConnections(
      connectionState.connectionIds.filter((memberId) => memberId !== member.id),
      connectionState.closeCompanionIds.filter((memberId) => memberId !== member.id),
      `${member.name} was removed from your church connections.`,
    );
  }

  function toggleCloseCompanion(member) {
    const isCloseCompanion = closeCompanionIds.has(member.id);
    const nextCloseCompanionIds = isCloseCompanion
      ? connectionState.closeCompanionIds.filter((memberId) => memberId !== member.id)
      : [...connectionState.closeCompanionIds, member.id];

    persistConnections(
      connectionState.connectionIds,
      nextCloseCompanionIds,
      isCloseCompanion
        ? `${member.name} is now listed as a church friend.`
        : `${member.name} is now one of your close companions.`,
    );
  }

  return (
    <section className="member-connections" aria-labelledby="member-connections-title">
      <header className="member-connections-heading">
        <p className="dashboard-eyebrow">People</p>
        <h2 id="member-connections-title">Your church connections.</h2>
        <p>
          Keep the people you intentionally added as friends or closer companions in one simple place.
        </p>
      </header>

      <section className="member-connections-privacy">
        <span aria-hidden="true">♡</span>
        <p>
          Connections never reveal WGAP answers, prayers, journals, notebook photos, or private devotion details.
        </p>
      </section>

      {statusMessage ? <p className="member-connections-status" role="status">{statusMessage}</p> : null}

      <section className="member-connections-section" aria-labelledby="member-connections-list-title">
        <div className="member-connections-section-heading">
          <div>
            <p className="dashboard-eyebrow">My people</p>
            <h3 id="member-connections-list-title">Friends and close companions</h3>
          </div>
          <span>{connections.length}</span>
        </div>

        {connections.length ? (
          <div className="member-connections-list">
            {connections.map((member) => {
              const isCloseCompanion = closeCompanionIds.has(member.id);
              return (
                <article key={member.id} className="member-connection-card">
                  <span className="member-connection-avatar" aria-hidden="true">{member.name.charAt(0)}</span>
                  <div className="member-connection-copy">
                    <strong>{member.name}</strong>
                    <small>{isCloseCompanion ? 'Close companion' : 'Church friend'}</small>
                  </div>
                  <div className="member-connection-actions">
                    <button
                      type="button"
                      className={isCloseCompanion ? 'is-close-companion' : ''}
                      onClick={() => toggleCloseCompanion(member)}
                    >
                      {isCloseCompanion ? 'Close companion ✓' : 'Make close companion'}
                    </button>
                    <button type="button" onClick={() => removeConnection(member)}>Remove</button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="member-connections-empty">
            <strong>No church connections yet.</strong>
            <p>Add someone below when you want them to appear in your personal People space.</p>
          </div>
        )}
      </section>

      {suggestions.length ? (
        <section className="member-connections-section" aria-labelledby="member-connections-suggestions-title">
          <div className="member-connections-section-heading">
            <div>
              <p className="dashboard-eyebrow">Church members</p>
              <h3 id="member-connections-suggestions-title">People you may know</h3>
            </div>
          </div>
          <div className="member-connections-list">
            {suggestions.map((member) => (
              <article key={member.id} className="member-connection-card">
                <span className="member-connection-avatar" aria-hidden="true">{member.name.charAt(0)}</span>
                <div className="member-connection-copy">
                  <strong>{member.name}</strong>
                  <small>Member of {organization?.name || 'your church'}</small>
                </div>
                <div className="member-connection-actions">
                  <button type="button" className="member-connection-add" onClick={() => addConnection(member)}>Add friend</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
