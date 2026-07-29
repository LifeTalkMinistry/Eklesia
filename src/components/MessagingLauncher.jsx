import { useEffect, useRef, useState } from 'react';
import {
  getPrototypeUnreadCount,
  MESSAGING_UPDATED_EVENT,
} from '../services/messagingService.js';
import MessagingCenter, { MessageBubbleIcon } from './MessagingCenter.jsx';

export default function MessagingLauncher({ currentUserName = 'You' }) {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(getPrototypeUnreadCount);
  const triggerRef = useRef(null);

  useEffect(() => {
    function handleUpdate() {
      setUnreadCount(getPrototypeUnreadCount());
    }
    window.addEventListener(MESSAGING_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(MESSAGING_UPDATED_EVENT, handleUpdate);
  }, []);

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
      />
    </>
  );
}
