import { useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteAllMessagingAttachments,
  deleteMessagingAttachment,
  formatAttachmentSize,
  getMessagingAttachment,
  MAX_MESSAGE_ATTACHMENTS,
  saveMessagingAttachment,
} from '../services/messagingAttachmentService.js';
import {
  deletePrototypeMessage,
  ensureMessagingThread,
  getMessagingState,
  markPrototypeThreadRead,
  MESSAGING_UPDATED_EVENT,
  sendPrototypeMessage,
  togglePrototypeReaction,
} from '../services/messagingService.js';
import './Messaging.css';
import './MessagingDirectory.css';
import './MessagingAttachments.css';

const EMOJI_OPTIONS = ['😀', '😂', '🥹', '😍', '😇', '🙏', '👍', '❤️', '🎉', '🔥', '👏', '💪', '😢', '😮', '🤍', '✨'];
const URL_PATTERN = /https?:\/\/[^\s<]+/gi;

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

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8.6 12.9 6.2-6.2a3.2 3.2 0 0 1 4.5 4.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l7.4-7.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2.4" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="9" cy="10" r="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="m5.5 17 4.2-4.1 3 2.8 2.2-2.1 3.6 3.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DetailsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 10.8v5M12 7.5h.01" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 4 16 8-16 8 3-8-3-8Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M7.2 12H20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function sortedThreads(state) {
  return [...(state?.threads || [])].sort((first, second) => (
    new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
  ));
}

function extractLinks(text) {
  return String(text || '').match(URL_PATTERN) || [];
}

function AttachmentView({ attachment, compact = false }) {
  const [record, setRecord] = useState(null);
  const [objectUrl, setObjectUrl] = useState('');

  useEffect(() => {
    let active = true;
    let createdUrl = '';
    getMessagingAttachment(attachment.id).then((stored) => {
      if (!active || !stored?.blob) return;
      createdUrl = URL.createObjectURL(stored.blob);
      setRecord(stored);
      setObjectUrl(createdUrl);
    });
    return () => {
      active = false;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [attachment.id]);

  function openAttachment() {
    if (!objectUrl) return;
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = record?.name || attachment.name || 'attachment';
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    anchor.click();
  }

  if (attachment.kind === 'image') {
    return (
      <button className={`message-image-attachment ${compact ? 'is-compact' : ''}`} type="button" onClick={openAttachment} disabled={!objectUrl}>
        {objectUrl ? <img src={objectUrl} alt={attachment.name} /> : <span>Loading image…</span>}
      </button>
    );
  }

  return (
    <button className="message-file-attachment" type="button" onClick={openAttachment} disabled={!objectUrl}>
      <span aria-hidden="true">{attachment.kind === 'pdf' ? 'PDF' : 'FILE'}</span>
      <span>
        <strong>{attachment.name}</strong>
        <small>{formatAttachmentSize(attachment.size)} · {objectUrl ? 'Open or save' : 'Loading…'}</small>
      </span>
    </button>
  );
}

function SharedConversationItems({ thread, onBack }) {
  const attachments = thread.messages.flatMap((message) => (
    message.deletedAt ? [] : message.attachments.map((attachment) => ({ ...attachment, messageId: message.id }))
  ));
  const media = attachments.filter((attachment) => attachment.kind === 'image');
  const files = attachments.filter((attachment) => attachment.kind !== 'image');
  const links = thread.messages.flatMap((message) => (
    message.deletedAt ? [] : extractLinks(message.text).map((url) => ({ url, messageId: message.id }))
  ));

  return (
    <section className="messaging-shared-panel" aria-labelledby="shared-conversation-heading">
      <header className="messaging-chat-header">
        <button className="messaging-header-icon" type="button" onClick={onBack} aria-label="Return to conversation">←</button>
        <span className="messaging-chat-avatar" aria-hidden="true">{thread.type === 'room' ? '♧' : thread.title.charAt(0)}</span>
        <div className="messaging-chat-identity">
          <strong id="shared-conversation-heading">Conversation details</strong>
          <small>{thread.title}</small>
        </div>
      </header>

      <div className="messaging-shared-content">
        <section>
          <h4>Photos and images <span>{media.length}</span></h4>
          {media.length ? (
            <div className="messaging-shared-media-grid">
              {media.map((attachment) => <AttachmentView key={attachment.id} attachment={attachment} compact />)}
            </div>
          ) : <p>No shared images yet.</p>}
        </section>

        <section>
          <h4>Files <span>{files.length}</span></h4>
          {files.length ? (
            <div className="messaging-shared-file-list">
              {files.map((attachment) => <AttachmentView key={attachment.id} attachment={attachment} />)}
            </div>
          ) : <p>No shared files yet.</p>}
        </section>

        <section>
          <h4>Links <span>{links.length}</span></h4>
          {links.length ? (
            <div className="messaging-shared-link-list">
              {links.map((link, index) => (
                <a href={link.url} target="_blank" rel="noopener noreferrer" key={`${link.messageId}-${index}`}>{link.url}</a>
              ))}
            </div>
          ) : <p>No shared links yet.</p>}
        </section>
      </div>
    </section>
  );
}

export function ThreadConversation({
  thread,
  currentUserName = 'You',
  onThreadUpdated,
  compact = false,
  onBack,
  onClose,
}) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sharedOpen, setSharedOpen] = useState(false);
  const [replyToId, setReplyToId] = useState('');
  const [savingAttachment, setSavingAttachment] = useState(false);
  const messageEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);

  const replyTarget = thread.messages.find((message) => message.id === replyToId) || null;
  const canSend = Boolean(draft.trim() || pendingAttachments.length);

  useEffect(() => {
    if (!sharedOpen) messageEndRef.current?.scrollIntoView({ block: 'end' });
  }, [thread?.messages?.length, sharedOpen]);

  useEffect(() => {
    setSharedOpen(false);
    setReplyToId('');
    setEmojiOpen(false);
  }, [thread.id]);

  async function addFiles(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected.length) return;
    if (pendingAttachments.length + selected.length > MAX_MESSAGE_ATTACHMENTS) {
      setError(`You can attach up to ${MAX_MESSAGE_ATTACHMENTS} files in one message.`);
      return;
    }

    setSavingAttachment(true);
    setError('');
    const saved = [];
    for (const file of selected) {
      const result = await saveMessagingAttachment(file);
      if (!result.ok) {
        setError(result.error || 'One attachment could not be saved.');
        continue;
      }
      saved.push(result.attachment);
    }
    setPendingAttachments((current) => [...current, ...saved].slice(0, MAX_MESSAGE_ATTACHMENTS));
    setSavingAttachment(false);
  }

  async function removePendingAttachment(attachment) {
    await deleteMessagingAttachment(attachment.id);
    setPendingAttachments((current) => current.filter((item) => item.id !== attachment.id));
  }

  function submitMessage(event) {
    event.preventDefault();
    const result = sendPrototypeMessage(thread.id, {
      text: draft,
      attachments: pendingAttachments,
      replyToId,
    }, currentUserName);
    if (!result.ok) {
      setError(result.error || 'The message could not be saved.');
      return;
    }
    setDraft('');
    setPendingAttachments([]);
    setReplyToId('');
    setEmojiOpen(false);
    setError('');
    onThreadUpdated?.(result.thread, result.state);
  }

  function handleDraftKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
      event.preventDefault();
      if (canSend) event.currentTarget.form?.requestSubmit();
    }
  }

  function applyReaction(messageId, emoji) {
    const result = togglePrototypeReaction(thread.id, messageId, emoji);
    if (!result.ok) {
      setError(result.error || 'The reaction could not be saved.');
      return;
    }
    onThreadUpdated?.(result.thread, result.state);
  }

  async function removeMessage(message) {
    if (!window.confirm('Remove this message from this device?')) return;
    await Promise.all(message.attachments.map((attachment) => deleteMessagingAttachment(attachment.id)));
    const result = deletePrototypeMessage(thread.id, message.id);
    if (!result.ok) {
      setError(result.error || 'The message could not be removed.');
      return;
    }
    onThreadUpdated?.(result.thread, result.state);
  }

  async function copyMessage(text) {
    try {
      await navigator.clipboard.writeText(text);
      setError('');
    } catch {
      setError('Your browser could not copy this message.');
    }
  }

  if (sharedOpen) {
    return <SharedConversationItems thread={thread} onBack={() => setSharedOpen(false)} />;
  }

  return (
    <div className={`messaging-conversation ${compact ? 'is-compact' : ''}`}>
      {!compact ? (
        <header className="messaging-chat-header">
          <button className="messaging-header-icon" type="button" onClick={onBack} aria-label="All messages">←</button>
          <span className="messaging-chat-avatar" aria-hidden="true">{thread.type === 'room' ? '♧' : thread.title.charAt(0)}</span>
          <div className="messaging-chat-identity">
            <strong>{thread.title}</strong>
            <small>{thread.subtitle}</small>
          </div>
          <button className="messaging-header-icon" type="button" onClick={() => setSharedOpen(true)} aria-label="Media, files and links" title="Media, files and links">
            <DetailsIcon />
          </button>
          <button className="messaging-header-icon" type="button" onClick={onClose} aria-label="Close messages">×</button>
        </header>
      ) : null}

      <div className="messaging-message-list" role="log" aria-live="polite" aria-label={`Messages in ${thread.title}`}>
        {thread.messages.length ? thread.messages.map((message) => {
          const senderLabel = message.senderType === 'me' ? 'You' : message.senderName || thread.title;
          if (message.senderType === 'system') {
            return (
              <article className="messaging-system-message" key={message.id}>
                <span>{message.text}</span>
              </article>
            );
          }

          return (
            <article className={`messaging-message is-${message.senderType} ${message.deletedAt ? 'is-deleted' : ''}`} key={message.id}>
              {message.senderType !== 'me' ? <span className="messaging-sender-name">{senderLabel}</span> : null}
              <div className="messaging-message-row">
                {message.senderType !== 'me' ? <span className="messaging-inline-avatar" aria-hidden="true">{senderLabel.charAt(0)}</span> : null}
                <div className="messaging-bubble">
                  {message.replyTo ? (
                    <blockquote>
                      <strong>{message.replyTo.senderName || 'Message'}</strong>
                      <span>{message.replyTo.text || 'Attachment'}</span>
                    </blockquote>
                  ) : null}
                  {message.deletedAt ? <p className="messaging-removed-message">Message removed</p> : null}
                  {!message.deletedAt && message.text ? <p>{message.text}</p> : null}
                  {!message.deletedAt && message.attachments.length ? (
                    <div className="messaging-message-attachments">
                      {message.attachments.map((attachment) => <AttachmentView key={attachment.id} attachment={attachment} />)}
                    </div>
                  ) : null}
                </div>

                {!message.deletedAt ? (
                  <div className="messaging-message-actions" aria-label={`Actions for ${senderLabel}'s message`}>
                    <button type="button" onClick={() => setReplyToId(message.id)} aria-label="Reply">↩</button>
                    <button type="button" onClick={() => applyReaction(message.id, '❤️')} aria-label="React with heart">♡</button>
                    {message.text ? <button type="button" onClick={() => copyMessage(message.text)} aria-label="Copy message">⋯</button> : null}
                    {message.senderType === 'me' ? <button type="button" onClick={() => removeMessage(message)} aria-label="Remove message">×</button> : null}
                  </div>
                ) : null}
              </div>

              {!message.deletedAt && message.reactions.length ? (
                <div className="messaging-reaction-summary">
                  {message.reactions.map((reaction) => (
                    <button className={reaction.reactedByMe ? 'is-mine' : ''} type="button" key={reaction.emoji} onClick={() => applyReaction(message.id, reaction.emoji)}>
                      {reaction.emoji} {reaction.count}
                    </button>
                  ))}
                </div>
              ) : null}

              <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
            </article>
          );
        }) : (
          <div className="messaging-empty-conversation">
            <MessageBubbleIcon />
            <strong>Start the conversation.</strong>
            <p>Send a message, emoji, image, PDF, or document.</p>
          </div>
        )}
        <span ref={messageEndRef} />
      </div>

      <form className="messaging-composer" onSubmit={submitMessage}>
        {replyTarget ? (
          <div className="messaging-reply-preview">
            <span><strong>Replying to {replyTarget.senderType === 'me' ? 'yourself' : replyTarget.senderName || thread.title}</strong>{replyTarget.text || 'Attachment'}</span>
            <button type="button" onClick={() => setReplyToId('')} aria-label="Cancel reply">×</button>
          </div>
        ) : null}

        {pendingAttachments.length ? (
          <div className="messaging-pending-attachments">
            {pendingAttachments.map((attachment) => (
              <span key={attachment.id}>
                <b>{attachment.kind === 'image' ? 'IMG' : attachment.kind === 'pdf' ? 'PDF' : 'FILE'}</b>
                <span><strong>{attachment.name}</strong><small>{formatAttachmentSize(attachment.size)}</small></span>
                <button type="button" onClick={() => removePendingAttachment(attachment)} aria-label={`Remove ${attachment.name}`}>×</button>
              </span>
            ))}
          </div>
        ) : null}

        {emojiOpen ? (
          <div className="messaging-emoji-picker" aria-label="Choose an emoji">
            {EMOJI_OPTIONS.map((emoji) => (
              <button type="button" key={emoji} onClick={() => setDraft((current) => `${current}${emoji}`)}>{emoji}</button>
            ))}
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          className="messaging-file-input"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          onChange={addFiles}
          tabIndex="-1"
          aria-hidden="true"
        />
        <input
          ref={photoInputRef}
          className="messaging-file-input"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={addFiles}
          tabIndex="-1"
          aria-hidden="true"
        />

        <div className="messaging-composer-row">
          <button className="messaging-composer-icon" type="button" onClick={() => fileInputRef.current?.click()} disabled={savingAttachment || pendingAttachments.length >= MAX_MESSAGE_ATTACHMENTS} aria-label="Attach a file">
            <PaperclipIcon />
          </button>
          <button className="messaging-composer-icon" type="button" onClick={() => photoInputRef.current?.click()} disabled={savingAttachment || pendingAttachments.length >= MAX_MESSAGE_ATTACHMENTS} aria-label="Attach a photo">
            <PhotoIcon />
          </button>
          <div className="messaging-input-shell">
            <textarea
              id={`message-draft-${thread.id}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder={`Message ${thread.title}`}
              rows="1"
              maxLength="4000"
            />
            <button type="button" onClick={() => setEmojiOpen((current) => !current)} aria-label="Choose emoji">☺</button>
          </div>
          <button className="messaging-send-button" type="submit" disabled={!canSend} aria-label="Send message">
            <SendIcon />
          </button>
        </div>

        {savingAttachment ? <p className="messaging-composer-status" role="status">Preparing attachment…</p> : null}
        {error ? <p className="messaging-error" role="alert">{error}</p> : null}
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
    const latestMessage = [...thread.messages].reverse().find((message) => !message.deletedAt);
    const preview = latestMessage?.text || latestMessage?.attachments?.[0]?.name || thread.subtitle;
    return (
      <button type="button" key={thread.id} onClick={() => selectThread(thread.id)}>
        <span className="messaging-thread-avatar" aria-hidden="true">{thread.type === 'room' ? '♧' : thread.title.charAt(0)}</span>
        <span>
          <strong>{thread.title}</strong>
          <small>{preview}</small>
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
      <section
        className={`messaging-dialog ${selectedThread ? 'is-thread-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={selectedThread ? undefined : 'messaging-dialog-title'}
        aria-label={selectedThread ? `Conversation with ${selectedThread.title}` : undefined}
      >
        {selectedThread ? (
          <ThreadConversation
            thread={selectedThread}
            currentUserName={currentUserName}
            onBack={() => setSelectedThreadId('')}
            onClose={closeDialog}
            onThreadUpdated={(thread, updatedState) => {
              setState(updatedState || getMessagingState());
              setSelectedThreadId(thread.id);
            }}
          />
        ) : (
          <>
            <header className="messaging-dialog-header">
              <div>
                <p className="dashboard-eyebrow">Private Alpha messaging</p>
                <h2 id="messaging-dialog-title">Messages</h2>
                <p>Search churchmates and continue your conversations.</p>
              </div>
              <div className="messaging-dialog-header-actions">
                <button type="button" onClick={openChurchmateSearch} aria-label="Start a new message" title="New message">
                  <NewMessageIcon />
                </button>
                <button ref={closeButtonRef} type="button" onClick={closeDialog} aria-label="Close messages">×</button>
              </div>
            </header>

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
          </>
        )}
      </section>
    </div>
  );
}

export { deleteAllMessagingAttachments };
