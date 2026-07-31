import { useEffect, useRef, useState } from 'react';
import {
  deleteChurchHomeItem,
  saveChurchHomeItem,
} from '../services/churchHomeService.js';

const COLLECTION_KEYS = {
  announcement: 'announcements',
  acknowledgement: 'acknowledgements',
  event: 'events',
};

function createEmptyForm(type) {
  if (type === 'announcement') {
    return {
      category: 'Church announcement',
      title: '',
      description: '',
      dateLabel: 'Posted today',
      eventDate: '',
      time: '',
      location: '',
      actionLabel: 'View details',
      connectedMinistryId: '',
      connectedGroupId: '',
      imageUrl: '',
      featured: false,
    };
  }

  if (type === 'acknowledgement') {
    return {
      category: 'Church family',
      title: '',
      message: '',
      dateLabel: 'Shared today',
      memberId: '',
      ministryId: '',
      groupId: '',
      imageUrl: '',
      approvedForChurchDisplay: false,
    };
  }

  return {
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    ministryId: '',
    groupId: '',
  };
}

function EditorDialog({ editor, form, setForm, ministries, groups, saving, error, onClose, onSave }) {
  const firstFieldRef = useRef(null);
  const typeLabel = editor.type === 'announcement'
    ? 'announcement'
    : editor.type === 'acknowledgement' ? 'acknowledgement' : 'church event';

  useEffect(() => {
    firstFieldRef.current?.focus();
    function handleEscape(event) {
      if (event.key === 'Escape' && !saving) onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, saving]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="church-home-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !saving && onClose()}>
      <section className="church-home-dialog" role="dialog" aria-modal="true" aria-labelledby="church-home-editor-title">
        <div className="church-home-dialog-heading">
          <div>
            <p className="dashboard-eyebrow">Live church content</p>
            <h2 id="church-home-editor-title">{editor.itemId ? 'Edit' : 'Create'} {typeLabel}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close editor" disabled={saving}>×</button>
        </div>

        <form className="church-home-admin-form" onSubmit={onSave}>
          {editor.type !== 'event' ? (
            <label>
              <span>Category</span>
              <input ref={firstFieldRef} value={form.category} onChange={(event) => update('category', event.target.value)} required disabled={saving} />
            </label>
          ) : null}

          <label>
            <span>Title</span>
            <input ref={editor.type === 'event' ? firstFieldRef : undefined} value={form.title} onChange={(event) => update('title', event.target.value)} required disabled={saving} />
          </label>

          <label className="church-home-admin-form-wide">
            <span>{editor.type === 'acknowledgement' ? 'Message' : 'Description'}</span>
            <textarea
              rows="4"
              value={editor.type === 'acknowledgement' ? form.message : form.description}
              onChange={(event) => update(editor.type === 'acknowledgement' ? 'message' : 'description', event.target.value)}
              required
              disabled={saving}
            />
          </label>

          {editor.type === 'announcement' ? (
            <>
              <label><span>Posting label</span><input value={form.dateLabel} onChange={(event) => update('dateLabel', event.target.value)} disabled={saving} /></label>
              <label><span>Event date label</span><input value={form.eventDate} onChange={(event) => update('eventDate', event.target.value)} placeholder="Saturday" disabled={saving} /></label>
              <label><span>Time</span><input value={form.time} onChange={(event) => update('time', event.target.value)} placeholder="2:00 PM" disabled={saving} /></label>
              <label><span>Location</span><input value={form.location} onChange={(event) => update('location', event.target.value)} disabled={saving} /></label>
              <label><span>Button label</span><input value={form.actionLabel} onChange={(event) => update('actionLabel', event.target.value)} disabled={saving} /></label>
              <label><span>Optional image URL</span><input type="url" value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} disabled={saving} /></label>
              <label><span>Connected ministry</span><select value={form.connectedMinistryId} onChange={(event) => update('connectedMinistryId', event.target.value)} disabled={saving}><option value="">None</option>{ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></label>
              <label><span>Connected Group</span><select value={form.connectedGroupId} onChange={(event) => update('connectedGroupId', event.target.value)} disabled={saving}><option value="">None</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
              <label className="church-home-admin-check church-home-admin-form-wide"><input type="checkbox" checked={form.featured} onChange={(event) => update('featured', event.target.checked)} disabled={saving} /><span>Feature this announcement on the billboard</span></label>
            </>
          ) : null}

          {editor.type === 'acknowledgement' ? (
            <>
              <label><span>Date label</span><input value={form.dateLabel} onChange={(event) => update('dateLabel', event.target.value)} disabled={saving} /></label>
              <label><span>Optional image URL</span><input type="url" value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} disabled={saving} /></label>
              <label><span>Associated ministry</span><select value={form.ministryId} onChange={(event) => update('ministryId', event.target.value)} disabled={saving}><option value="">None</option>{ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></label>
              <label><span>Associated Group</span><select value={form.groupId} onChange={(event) => update('groupId', event.target.value)} disabled={saving}><option value="">None</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
              <label className="church-home-admin-check church-home-admin-form-wide"><input type="checkbox" checked={form.approvedForChurchDisplay} onChange={(event) => update('approvedForChurchDisplay', event.target.checked)} disabled={saving} /><span>I confirm this content is approved for church-wide display</span></label>
            </>
          ) : null}

          {editor.type === 'event' ? (
            <>
              <label><span>Date</span><input value={form.date} onChange={(event) => update('date', event.target.value)} placeholder="Wednesday" required disabled={saving} /></label>
              <label><span>Time</span><input value={form.time} onChange={(event) => update('time', event.target.value)} placeholder="7:00 PM" required disabled={saving} /></label>
              <label><span>Location</span><input value={form.location} onChange={(event) => update('location', event.target.value)} required disabled={saving} /></label>
              <label><span>Connected ministry</span><select value={form.ministryId} onChange={(event) => update('ministryId', event.target.value)} disabled={saving}><option value="">None</option>{ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></label>
              <label><span>Connected Group</span><select value={form.groupId} onChange={(event) => update('groupId', event.target.value)} disabled={saving}><option value="">None</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            </>
          ) : null}

          {error ? <p className="church-workspace-error church-home-admin-form-wide" role="alert">{error}</p> : null}

          <div className="church-home-dialog-actions church-home-admin-form-wide">
            <button className="church-home-secondary-action" type="button" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="church-home-primary-action" type="submit" disabled={saving}>{saving ? 'Saving…' : `Save ${typeLabel}`}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AdminCollection({ title, description, items, type, busy, onCreate, onEdit, onDelete }) {
  return (
    <section className="church-home-admin-collection">
      <div className="church-home-section-heading">
        <div><h3>{title}</h3><p>{description}</p></div>
        <button type="button" onClick={() => onCreate(type)} disabled={busy}>Add new</button>
      </div>
      <div className="church-home-admin-items">
        {items.length ? items.map((item) => (
          <article key={item.id}>
            <div><strong>{item.title}</strong><small>{item.dateLabel || [item.date, item.time].filter(Boolean).join(' · ') || 'No date label'}</small></div>
            <div><button type="button" onClick={() => onEdit(type, item)} disabled={busy}>Edit</button><button className="is-danger" type="button" onClick={() => onDelete(type, item)} disabled={busy}>Delete</button></div>
          </article>
        )) : <p className="church-home-privacy-note">No items have been published yet.</p>}
      </div>
    </section>
  );
}

export default function ChurchHomeAdmin({ organization, workspace, home, onHomeChange }) {
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(createEmptyForm('announcement'));
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ministries = workspace.ministries || [];
  const groups = workspace.groups || [];

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(organization.organizationCode || organization.code || '');
      setStatus(`Code ${organization.organizationCode || organization.code} copied.`);
    } catch (copyError) {
      console.warn('Church code copy failed.', copyError);
      setStatus(`Church code: ${organization.organizationCode || organization.code}`);
    }
  }

  function openEditor(type, item = null) {
    setError('');
    setForm(item ? { ...createEmptyForm(type), ...item } : createEmptyForm(type));
    setEditor({ type, itemId: item?.id || '' });
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (!editor || busy) return;
    setBusy(true);
    setError('');
    try {
      const savedItem = await saveChurchHomeItem(editor.type, editor.itemId, form);
      const key = COLLECTION_KEYS[editor.type];
      const nextItems = editor.itemId
        ? home[key].map((item) => item.id === editor.itemId ? savedItem : item)
        : [savedItem, ...home[key]];
      onHomeChange({ ...home, [key]: nextItems });
      setStatus(`${editor.type === 'event' ? 'Church event' : editor.type} published to the church.`);
      setEditor(null);
    } catch (saveError) {
      setError(saveError.message || 'The church content could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(type, item) {
    const confirmed = window.confirm(`Delete “${item.title}” for every church member?`);
    if (!confirmed || busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteChurchHomeItem(type, item.id);
      const key = COLLECTION_KEYS[type];
      onHomeChange({ ...home, [key]: home[key].filter((entry) => entry.id !== item.id) });
      setStatus(`${item.title} was removed from Church Home.`);
    } catch (deleteError) {
      setStatus('');
      setError(deleteError.message || 'The church content could not be deleted.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="church-home-admin" aria-labelledby="church-home-admin-title">
      <details>
        <summary>
          <span><small>Church owner and admins</small><strong id="church-home-admin-title">Church Home Admin</strong><em>Publish announcements, acknowledgements, and events to every connected member.</em></span>
          <b aria-hidden="true">+</b>
        </summary>

        <div className="church-home-admin-body">
          {status ? <p className="church-home-status" role="status">{status}</p> : null}
          {error && !editor ? <p className="church-workspace-error" role="alert">{error}</p> : null}

          <section className="church-home-code-card" aria-labelledby="church-home-code-title">
            <div><p className="dashboard-eyebrow">Organization access</p><h3 id="church-home-code-title">Church code</h3><p>New members use this backend-managed code to join the church organization.</p></div>
            <div className="church-home-code-row"><code>{organization.organizationCode || organization.code}</code><button type="button" onClick={copyCode}>Copy</button></div>
          </section>

          <div className="church-home-admin-shortcuts">
            <button type="button" onClick={() => openEditor('announcement')} disabled={busy}>Create announcement</button>
            <button type="button" onClick={() => openEditor('acknowledgement')} disabled={busy}>Post acknowledgement</button>
            <button type="button" onClick={() => openEditor('event')} disabled={busy}>Create church event</button>
          </div>

          <AdminCollection title="Announcements" description="Create, feature, edit, or remove church-wide announcements." items={home.announcements} type="announcement" busy={busy} onCreate={openEditor} onEdit={openEditor} onDelete={deleteItem} />
          <AdminCollection title="Acknowledgements" description="Only manually approved content is shown to ordinary members." items={home.acknowledgements} type="acknowledgement" busy={busy} onCreate={openEditor} onEdit={openEditor} onDelete={deleteItem} />
          <AdminCollection title="Church events" description="Manage the activities displayed under Coming Up." items={home.events} type="event" busy={busy} onCreate={openEditor} onEdit={openEditor} onDelete={deleteItem} />
        </div>
      </details>

      {editor ? (
        <EditorDialog
          editor={editor}
          form={form}
          setForm={setForm}
          ministries={ministries}
          groups={groups}
          saving={busy}
          error={error}
          onClose={() => !busy && setEditor(null)}
          onSave={saveEditor}
        />
      ) : null}
    </section>
  );
}
