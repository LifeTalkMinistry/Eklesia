import { useEffect, useState } from 'react';
import {
  ensureMessagingThread,
  getMessagingState,
  MESSAGING_UPDATED_EVENT,
} from '../services/messagingService.js';
import { MessageBubbleIcon, ThreadConversation } from './MessagingCenter.jsx';

export default function RoomChatPanel({ roomId, roomName, currentUserName = 'You', roomType = 'group' }) {
  const target = {
    type: 'room',
    id: roomId,
    name: roomName,
    subtitle: `${roomType === 'D-Group' ? 'D-Group' : 'Ministry room'} chat`,
  };
  const [thread, setThread] = useState(() => ensureMessagingThread(target).thread);

  useEffect(() => {
    const result = ensureMessagingThread(target);
    setThread(result.thread);

    function handleUpdate(event) {
      const updated = (event.detail?.state || getMessagingState()).threads.find((item) => item.id === `room:${roomId}`);
      if (updated) setThread(updated);
    }

    window.addEventListener(MESSAGING_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(MESSAGING_UPDATED_EVENT, handleUpdate);
  }, [roomId, roomName, roomType]);

  if (!thread) {
    return (
      <section className="group-workspace-panel room-chat-panel">
        <p className="group-workspace-empty">This room chat is unavailable.</p>
      </section>
    );
  }

  return (
    <section className="group-workspace-panel room-chat-panel" aria-labelledby={`room-chat-heading-${roomId}`}>
      <div className="group-workspace-section-heading room-chat-heading">
        <div>
          <p className="dashboard-eyebrow">{roomType} conversation</p>
          <h3 id={`room-chat-heading-${roomId}`}>Room Chat</h3>
        </div>
        <MessageBubbleIcon />
      </div>
      <p className="group-workspace-panel-intro">
        A shared conversation space for members of {roomName}. This Private Alpha version remains local to this device.
      </p>
      <ThreadConversation
        thread={thread}
        currentUserName={currentUserName}
        compact
        onThreadUpdated={(updatedThread) => setThread(updatedThread)}
      />
    </section>
  );
}
