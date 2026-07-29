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
  MESSAGE_REACTION_OPTIONS,
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
      <div className="messaging-shared-heading">
        <button type="button" onClick={onBack}>← Chat</button>
        <div>
          <p className="dashboard-eyebrow">Conversation details</p>
          <h3 id="shared-conversation-heading">Media, files and links</h3>
        </div>
      </div>

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
    </section>
  );
}

export function ThreadConversation({ thread, currentUserName = 'You', onThreadUpdated, compact = false }) {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sharedOpen, setSharedOpen] = useState(false);
  const [replyToId, setReplyToId] = useState('');
  const [savingAttachment, setSavingAttachment] = useState(false);
  const messageEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const replyTarget = thread.messages.find((message) => message.id === replyToId) || null;

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
      <div className="messaging-conversation-tools">
        <button type="button" onClick={() => setSharedOpen(true)}>Media & files</button>
      </div>
      <div className="messaging-message-list" role="log" aria-live="polite" aria-label={`Messages in ${thread.title}`}>
        {thread.messages.length ? thread.messages.map((message) => (
          <article className={`messaging-message is-${message.senderType} ${message.deletedAt ? 'is-deleted' : ''}`} key={message.id}>
            <div className="messaging-message-meta">
              <strong>{message.senderType === 'me' ? 'You' : message.senderName || thread.title}</strong>
              <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
            </div>
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
            {!message.deletedAt && message.reactions.length ? (
              <div className="messaging-reaction-summary">
                {message.reactions.map((reaction) => (
                  <button className={reaction.reactedByMe ? 'is-mine' : ''} type="button" key={reaction.emoji} onClick={() => applyReaction(message.id, reaction.emoji)}>
                    {reaction.emoji} {reaction.count}
                  </button>
                ))}
              </div>
            ) : null}
            {!message.deletedAt && message.senderType !== 'system' ? (
              <div className="messaging-message-actions">
                <button type="button" onClick={() => setReplyToId(message.id)}>Reply</button>
                {MESSAGE_REACTION_OPTIONS.slice(0, 3).map((emoji) => (
                  <button type="button" onClick={() => applyReaction(message.id, emoji)} key={emoji} aria-label={`React ${emoji}`}>{emoji}</button>
                ))}
                {message.text ? <button type="button" onClick={() => copyMessage(message.text)}>Copy</button> : null}
                {message.senderType === 'me' ? <button type="button" onClick={() => removeMessage(message)}>Remove</button> : null}
              </div>
            ) : null}
          </article>
        )) : (
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
        <div className="messaging-composer-row">
          <button className="messaging-tool-button" type="button" onClick={() => fileInputRef.current?.click()} disabled={savingAttachment || pendingAttachments.length >= MAX_MESSAGE_ATTACHMENTS} aria-label="Attach photos or files">
            <PaperclipIcon />
          </button>
          <textarea
            id={`message-draft-${thread.id}`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={`Message ${thread.title}`}
            rows="2"
            maxLength="4000"
          />
          <button className="messaging-tool-button" type="button" onClick={() => setEmojiOpen((current) => !current)} aria-label="Choose emoji">☺</button>
          <button className="messaging-send-button" type="submit" disabled={!draft.trim() && !pendingAttachments.length}>Send</button>
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

export { deleteAllMessagingAttachments };
