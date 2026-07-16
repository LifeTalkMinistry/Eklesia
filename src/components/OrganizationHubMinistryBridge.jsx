import { useEffect, useRef } from 'react';
import OrganizationHub from './OrganizationHub.jsx';

export default function OrganizationHubMinistryBridge({ workspace, onOpenMinistry, ...props }) {
  const hostRef = useRef(null);

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

        if (existingButton) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'organization-enter-ministry-room';
        button.dataset.enterMinistryRoom = ministry.id;
        button.textContent = 'Enter Ministry Room';
        button.setAttribute('aria-label', `Enter ${ministry.name} ministry room`);
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
    observer.observe(host, { childList: true, subtree: true, characterData: true });
    host.addEventListener('click', handleClick);
    enhanceMinistryCards();

    return () => {
      observer.disconnect();
      host.removeEventListener('click', handleClick);
    };
  }, [workspace, onOpenMinistry]);

  return (
    <div ref={hostRef} className="organization-hub-ministry-bridge">
      <OrganizationHub {...props} />
    </div>
  );
}
