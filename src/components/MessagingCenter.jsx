import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ensureMessagingThread,
  getMessagingState,
  markPrototypeThreadRead,
  MESSAGING_UPDATED_EVENT,
  sendPrototypeMessage,
} from '../services/messagingService.js';
import './Messaging.css';
import './MessagingDirectory.css';

export function MessageBubbleIcon({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5.75h14a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-7.2L7.2 21v-3.75H5a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M7.5 10.25h9M7.5 13.25h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="m15.2 15.2 4.3 4.3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function NewMessageIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 5.75h10.5a2 2 0 0 1 2 2v3.5M5 5.75a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2h2.2V21l4.6-3.75h2.45" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 13.25v6M15 16.25h6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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
            placeholder={`Message ${thread.title}`}
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

export default function MessagingCenter({
  open,
  onClose,
  triggerRef,
  initialTarget = null,
  currentUserName = 'You',
  contacts = [],
  churchName = '',
  directoryLoading = false,
}) {
  const [state, setState] = useState(getMessagingState);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const closeButtonRef = useRef(null);
  const searchInputRef = useRef(null);
  const initialTargetKey = initialTarget ? `${initialTarget.type || 'direct'}:${initialTarget.id}` : '';

  useEffect(() => {
    if (!open) return undefined;

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
    setSearchQuery('');
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
    setSearchQuery('');
  }, [open]);

  const threads = useMemo(() => sortedThreads(state), [state]);
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) || null;
  const normalizedContacts = useMemo(() => {
    const seen = new Set();
    return (Array.isArray(contacts) ? contacts : []).filter((contact) => {
      const id = String(contact?.id || '').trim();
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [contacts]);
  const query = searchQuery.trim().toLowerCase();
  const directThreadTargets = useMemo(() => new Set(
    threads.filter((thread) => thread.type === 'direct').map((thread) => thread.targetId),
  ), [threads]);
  const filteredContacts = useMemo(() => {
    if (!query) return normalizedContacts.filter((contact) => !directThreadTargets.has(contact.id)).slice(0, 6);
    return normalizedContacts.filter((contact) => (
      [contact.name, contact.subtitle, contact.searchText]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    ));
  }, [directThreadTargets, normalizedContacts, query]);

  function closeDialog() {
    onClose();
    window.requestAnimationFrame(() => triggerRef?.current?.focus());
  }

  function selectThread(threadId) {
    markPrototypeThreadRead(threadId);
    setState(getMessagingState());
    setSelectedThreadId(threadId);
  }

  function startConversation(contact) {
    const result = ensureMessagingThread({
      type: 'direct',
      id: contact.id,
      name: contact.name,
      subtitle: contact.subtitle || `Churchmate at ${churchName || 'your church'}`,
    });
    if (!result.ok || !result.thread) return;
    markPrototypeThreadRead(result.thread.id);
    setState(getMessagingState());
    setSelectedThreadId(result.thread.id);
    setSearchQuery('');
  }

  function openChurchmateSearch() {
    setSelectedThreadId('');
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function renderThreadButton(thread) {
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
            <p>{selectedThread ? selectedThread.subtitle : 'Search churchmates, open direct conversations, and enter room chats.'}</p>
          </div>
          <div className="messaging-dialog-header-actions">
            <button type="button" onClick={openChurchmateSearch} aria-label="Start a new message" title="New message">
              <NewMessageIcon />
            </button>
            <button ref={closeButtonRef} type="button" onClick={closeDialog} aria-label="Close messages">×</button>
          </div>
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
            <section className="messaging-directory-search" aria-labelledby="churchmate-search-heading">
              <div>
                <p className="dashboard-eyebrow">New conversation</p>
                <h3 id="churchmate-search-heading">Search churchmates</h3>
              </div>
              <label className="messaging-search-field" htmlFor="messaging-churchmate-search">
                <SearchIcon />
                <input
                  ref={searchInputRef}
                  id="messaging-churchmate-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search by name, ministry, or D-Group"
                  autoComplete="off"
                />
              </label>
              <small>Only members connected to {churchName || 'your joined church'} appear in this directory.</small>
            </section>

            {!query && threads.length ? (
              <section className="messaging-inbox-section" aria-labelledby="recent-conversations-heading">
                <div className="messaging-section-heading">
                  <h3 id="recent-conversations-heading">Recent conversations</h3>
                  <span>{threads.length}</span>
                </div>
                <div className="messaging-thread-list">
                  {threads.map(renderThreadButton)}
                </div>
              </section>
            ) : null}

            <section className="messaging-inbox-section" aria-labelledby="churchmate-results-heading">
              <div className="messaging-section-heading">
                <h3 id="churchmate-results-heading">{query ? 'Search results' : 'Suggested churchmates'}</h3>
                {!directoryLoading ? <span>{filteredContacts.length}</span> : null}
              </div>

              {directoryLoading ? (
                <p className="messaging-directory-status" role="status">Preparing your church directory…</p>
              ) : filteredContacts.length ? (
                <div className="messaging-contact-list">
                  {filteredContacts.map((contact) => (
                    <button type="button" key={contact.id} onClick={() => startConversation(contact)}>
                      <span className="messaging-thread-avatar" aria-hidden="true">{contact.name.charAt(0)}</span>
                      <span>
                        <strong>{contact.name}</strong>
                        <small>{contact.subtitle || 'Churchmate'}</small>
                      </span>
                      <b>Message</b>
                    </button>
                  ))}
                </div>
              ) : query ? (
                <div className="messaging-directory-empty">
                  <SearchIcon />
                  <strong>No churchmate found</strong>
                  <p>Try a name, ministry, D-Group, or leadership role from your church.</p>
                </div>
              ) : (
                <div className="messaging-directory-empty">
                  <MessageBubbleIcon />
                  <strong>{threads.length ? 'Your suggested list is clear' : 'No churchmates available yet'}</strong>
                  <p>{threads.length
                    ? 'Use the search field to reopen an existing direct conversation.'
                    : 'Join a church workspace to search its approved member directory.'}</p>
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
