import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ensureMessagingThread,
  getMessagingState,
  markPrototypeThreadRead,
  MESSAGING_UPDATED_EVENT,
  sendPrototypeMessage,
} from '../services/messagingService.js';
import './Messaging.css';

export function MessageBubbleIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5.75h14a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-7.2L7.2 21v-3.75H5a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M7.5 10.25h9M7.5 13.25h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function sortedThreads(state) {
  return [...(state?.threads || [])].sort((first, second) => (
    new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
  ));
}

export function ThreadConversation({ thread, currentUserName = 'You', onThreadUpdated, compact = false }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const messageEndRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages?.length]);

  function submitMessage(event) {
    event.preventDefault();
    const result = sendPrototypeMessage(thread.id, draft, currentUserName);
    if (!result.ok) {
      setError(result.error || 'The prototype message could not be saved.');
      return;
    }
    setDraft('');
    setError('');
    onThreadUpdated?.(result.thread, result.state);
  }

  return (
    <div className={`messaging-conversation ${compact ? 'is-compact' : ''}`}>
      <div className="messaging-message-list" role="log" aria-live="polite" aria-label={`Messages in ${thread.title}`}>
        {thread.messages.length ? thread.messages.map((message) => (
          <article className={`messaging-message is-${message.senderType}`} key={message.id}>
            <div>
              <strong>{message.senderType === 'me' ? 'You' : message.senderName || thread.title}</strong>
              <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
            </div>
            <p>{message.text}</p>
          </article>
        )) : (
          <div className="messaging-empty-conversation">
            <MessageBubbleIcon />
            <strong>Start the conversation.</strong>
            <p>This prototype stores messages only on this device. It does not send them to another person yet.</p>
          </div>
        )}
        <span ref={messageEndRef} />
      </div>
      <form className="messaging-composer" onSubmit={submitMessage}>
        <label htmlFor={`message-draft-${thread.id}`}>Message</label>
        <div>
          <textarea
            id={`message-draft-${thread.id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={thread.type === 'room' ? `Message ${thread.title}` : `Message ${thread.title}`}
            rows="2"
            maxLength="2000"
          />
          <button type="submit" disabled={!draft.trim()}>Send</button>
        </div>
        {error ? <p className="messaging-error" role="alert">{error}</p> : null}
        <small>Local prototype · Messages are not delivered to other members yet.</small>
      </form>
    </div>
  );
}

export default function MessagingCenter({ open, onClose, triggerRef, initialTarget = null, currentUserName = 'You' }) {
  const [state, setState] = useState(getMessagingState);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const closeButtonRef = useRef(null);
  const initialTargetKey = initialTarget ? `${initialTarget.type || 'direct'}:${initialTarget.id}` : '';

  useEffect(() => {
    if (!open) return undefined;

    const latest = getMessagingState();
    let selectedId = '';
    if (initialTarget?.id) {
      const result = ensureMessagingThread(initialTarget);
      if (result.ok && result.thread) {
        selectedId = result.thread.id;
        markPrototypeThreadRead(result.thread.id);
      }
    }

    setState(getMessagingState());
    setSelectedThreadId(selectedId);
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function handleUpdate(event) {
      setState(event.detail?.state || getMessagingState());
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }

    window.addEventListener(MESSAGING_UPDATED_EVENT, handleUpdate);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener(MESSAGING_UPDATED_EVENT, handleUpdate);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, initialTargetKey, onClose]);

  useEffect(() => {
    if (open) return;
    setSelectedThreadId('');
  }, [open]);

  const threads = useMemo(() => sortedThreads(state), [state]);
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) || null;

  function closeDialog() {
    onClose();
    window.requestAnimationFrame(() => triggerRef?.current?.focus());
  }

  function selectThread(threadId) {
    markPrototypeThreadRead(threadId);
    setState(getMessagingState());
    setSelectedThreadId(threadId);
  }

  if (!open) return null;

  return (
    <div className="messaging-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) closeDialog();
    }}>
      <section className="messaging-dialog" role="dialog" aria-modal="true" aria-labelledby="messaging-dialog-title">
        <header className="messaging-dialog-header">
          <div>
            <p className="dashboard-eyebrow">Private Alpha messaging</p>
            <h2 id="messaging-dialog-title">{selectedThread ? selectedThread.title : 'Messages'}</h2>
            <p>{selectedThread ? selectedThread.subtitle : 'Direct conversations and room chats saved on this device.'}</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={closeDialog} aria-label="Close messages">×</button>
        </header>

        {selectedThread ? (
          <div className="messaging-thread-view">
            <button className="messaging-back-button" type="button" onClick={() => setSelectedThreadId('')}>
              <span aria-hidden="true">←</span> All messages
            </button>
            <ThreadConversation
              thread={selectedThread}
              currentUserName={currentUserName}
              onThreadUpdated={(thread, updatedState) => {
                setState(updatedState || getMessagingState());
                setSelectedThreadId(thread.id);
              }}
            />
          </div>
        ) : (
          <div className="messaging-inbox">
            {threads.length ? threads.map((thread) => {
              const latestMessage = thread.messages[thread.messages.length - 1];
              return (
                <button type="button" key={thread.id} onClick={() => selectThread(thread.id)}>
                  <span className="messaging-thread-avatar" aria-hidden="true">{thread.type === 'room' ? '♧' : thread.title.charAt(0)}</span>
                  <span>
                    <strong>{thread.title}</strong>
                    <small>{latestMessage?.text || thread.subtitle}</small>
                  </span>
                  <span className="messaging-thread-meta">
                    <time dateTime={thread.updatedAt}>{thread.messages.length ? formatMessageTime(thread.updatedAt) : ''}</time>
                    {thread.unreadCount ? <b>{thread.unreadCount}</b> : null}
                  </span>
                </button>
              );
            }) : (
              <div className="messaging-empty-inbox">
                <MessageBubbleIcon />
                <h3>No conversations yet</h3>
                <p>Open a member’s shared progress summary to start a private conversation, or enter a ministry or D-Group Chat tab.</p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
