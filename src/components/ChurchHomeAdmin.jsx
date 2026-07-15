import { useEffect, useRef, useState } from 'react';
import { generatePrototypeCode } from '../services/organizationPrototypeService.js';

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

function EditorDialog({ editor, form, setForm, ministries, groups, onClose, onSave }) {
  const firstFieldRef = useRef(null);
  const typeLabel = editor.type === 'announcement'
    ? 'announcement'
    : editor.type === 'acknowledgement' ? 'acknowledgement' : 'church event';

  useEffect(() => {
    firstFieldRef.current?.focus();
    function handleEscape(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="church-home-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="church-home-dialog" role="dialog" aria-modal="true" aria-labelledby="church-home-editor-title">
        <div className="church-home-dialog-heading">
          <div>
            <p className="dashboard-eyebrow">Admin tools</p>
            <h2 id="church-home-editor-title">{editor.itemId ? 'Edit' : 'Create'} {typeLabel}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close editor">×</button>
        </div>

        <form className="church-home-admin-form" onSubmit={onSave}>
          {editor.type !== 'event' ? (
            <label>
              <span>Category</span>
              <input ref={firstFieldRef} value={form.category} onChange={(event) => update('category', event.target.value)} required />
            </label>
          ) : null}

          <label>
            <span>Title</span>
            <input ref={editor.type === 'event' ? firstFieldRef : undefined} value={form.title} onChange={(event) => update('title', event.target.value)} required />
          </label>

          <label className="church-home-admin-form-wide">
            <span>{editor.type === 'acknowledgement' ? 'Message' : 'Description'}</span>
            <textarea
              rows="4"
              value={editor.type === 'acknowledgement' ? form.message : form.description}
              onChange={(event) => update(editor.type === 'acknowledgement' ? 'message' : 'description', event.target.value)}
              required
            />
          </label>

          {editor.type === 'announcement' ? (
            <>
              <label><span>Posting label</span><input value={form.dateLabel} onChange={(event) => update('dateLabel', event.target.value)} /></label>
              <label><span>Event date label</span><input value={form.eventDate} onChange={(event) => update('eventDate', event.target.value)} placeholder="Saturday" /></label>
              <label><span>Time</span><input value={form.time} onChange={(event) => update('time', event.target.value)} placeholder="2:00 PM" /></label>
              <label><span>Location</span><input value={form.location} onChange={(event) => update('location', event.target.value)} /></label>
              <label><span>Button label</span><input value={form.actionLabel} onChange={(event) => update('actionLabel', event.target.value)} /></label>
              <label><span>Optional image URL</span><input type="url" value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} /></label>
              <label><span>Connected ministry</span><select value={form.connectedMinistryId} onChange={(event) => update('connectedMinistryId', event.target.value)}><option value="">None</option>{ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></label>
              <label><span>Connected Group</span><select value={form.connectedGroupId} onChange={(event) => update('connectedGroupId', event.target.value)}><option value="">None</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
              <label className="church-home-admin-check church-home-admin-form-wide"><input type="checkbox" checked={form.featured} onChange={(event) => update('featured', event.target.checked)} /><span>Feature this announcement on the billboard</span></label>
            </>
          ) : null}

          {editor.type === 'acknowledgement' ? (
            <>
              <label><span>Date label</span><input value={form.dateLabel} onChange={(event) => update('dateLabel', event.target.value)} /></label>
              <label><span>Optional image URL</span><input type="url" value={form.imageUrl} onChange={(event) => update('imageUrl', event.target.value)} /></label>
              <label><span>Associated ministry</span><select value={form.ministryId} onChange={(event) => update('ministryId', event.target.value)}><option value="">None</option>{ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></label>
              <label><span>Associated Group</span><select value={form.groupId} onChange={(event) => update('groupId', event.target.value)}><option value="">None</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
              <label className="church-home-admin-check church-home-admin-form-wide"><input type="checkbox" checked={form.approvedForChurchDisplay} onChange={(event) => update('approvedForChurchDisplay', event.target.checked)} /><span>I confirm this content is approved for church-wide display</span></label>
            </>
          ) : null}

          {editor.type === 'event' ? (
            <>
              <label><span>Date</span><input value={form.date} onChange={(event) => update('date', event.target.value)} placeholder="Wednesday" required /></label>
              <label><span>Time</span><input value={form.time} onChange={(event) => update('time', event.target.value)} placeholder="7:00 PM" required /></label>
              <label><span>Location</span><input value={form.location} onChange={(event) => update('location', event.target.value)} required /></label>
              <label><span>Connected ministry</span><select value={form.ministryId} onChange={(event) => update('ministryId', event.target.value)}><option value="">None</option>{ministries.map((ministry) => <option key={ministry.id} value={ministry.id}>{ministry.name}</option>)}</select></label>
              <label><span>Connected Group</span><select value={form.groupId} onChange={(event) => update('groupId', event.target.value)}><option value="">None</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
            </>
          ) : null}

          <div className="church-home-dialog-actions church-home-admin-form-wide">
            <button className="church-home-secondary-action" type="button" onClick={onClose}>Cancel</button>
            <button className="church-home-primary-action" type="submit">Save {typeLabel}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function AdminCollection({ title, description, items, type, onCreate, onEdit, onDelete }) {
  return (
    <section className="church-home-admin-collection">
      <div className="church-home-section-heading">
        <div><h3>{title}</h3><p>{description}</p></div>
        <button type="button" onClick={() => onCreate(type)}>Add new</button>
      </div>
      <div className="church-home-admin-items">
        {items.map((item) => (
          <article key={item.id}>
            <div><strong>{item.title}</strong><small>{item.dateLabel || [item.date, item.time].filter(Boolean).join(' · ') || 'No date label'}</small></div>
            <div><button type="button" onClick={() => onEdit(type, item)}>Edit</button><button className="is-danger" type="button" onClick={() => onDelete(type, item)}>Delete</button></div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function ChurchHomeAdmin({ organization, workspace, home, onWorkspaceChange, onHomeChange, onNavigate, onShowDetails }) {
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(createEmptyForm('announcement'));
  const [status, setStatus] = useState('');
  const ministries = workspace.ministries || [];
  const groups = workspace.groups || [];

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(workspace.organizationCode);
      setStatus(`Code ${workspace.organizationCode} copied.`);
    } catch (error) {
      console.warn('Church code copy failed.', error);
      setStatus(`Church code: ${workspace.organizationCode}`);
    }
  }

  function rotateCode() {
    onWorkspaceChange((current) => ({ ...current, organizationCode: generatePrototypeCode(organization.name) }));
    setStatus('The church code was rotated. Existing members remain connected.');
  }

  function openEditor(type, item = null) {
    setForm(item ? { ...createEmptyForm(type), ...item } : createEmptyForm(type));
    setEditor({ type, itemId: item?.id || '' });
  }

  function saveEditor(event) {
    event.preventDefault();
    const key = COLLECTION_KEYS[editor.type];
    const now = new Date().toISOString();
    const existing = home[key].find((item) => item.id === editor.itemId);
    const nextItem = {
      ...form,
      id: editor.itemId || `${editor.type}-${Date.now().toString(36)}`,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const nextItems = editor.itemId
      ? home[key].map((item) => item.id === editor.itemId ? nextItem : item)
      : [nextItem, ...home[key]];
    onHomeChange({ ...home, [key]: nextItems });
    setStatus(`${editor.type === 'event' ? 'Church event' : editor.type} saved.`);
    setEditor(null);
  }

  function deleteItem(type, item) {
    const confirmed = window.confirm(`Delete “${item.title}”? This only removes the local prototype item.`);
    if (!confirmed) return;
    const key = COLLECTION_KEYS[type];
    onHomeChange({ ...home, [key]: home[key].filter((entry) => entry.id !== item.id) });
    setStatus(`${item.title} was removed.`);
  }

  return (
    <section className="church-home-admin" aria-labelledby="church-home-admin-title">
      <details>
        <summary>
          <span><small>Authorized roles only</small><strong id="church-home-admin-title">Admin Tools</strong><em>Manage church access, announcements, acknowledgements, events, leaders, and organization settings.</em></span>
          <b aria-hidden="true">+</b>
        </summary>

        <div className="church-home-admin-body">
          {status ? <p className="church-home-status" role="status">{status}</p> : null}

          <section className="church-home-code-card" aria-labelledby="church-home-code-title">
            <div><p className="dashboard-eyebrow">Organization access</p><h3 id="church-home-code-title">Church code</h3><p>New members use this code to request entry into the whole church organization. It is separate from ministry and Group codes.</p></div>
            <div className="church-home-code-row"><code>{workspace.organizationCode}</code><button type="button" onClick={copyCode}>Copy</button><button type="button" onClick={rotateCode}>Rotate</button></div>
            <small>{workspace.approvalMode} · Rotating the code does not remove existing members.</small>
          </section>

          <div className="church-home-admin-shortcuts">
            <button type="button" onClick={() => openEditor('announcement')}>Create announcement</button>
            <button type="button" onClick={() => openEditor('acknowledgement')}>Post acknowledgement</button>
            <button type="button" onClick={() => openEditor('event')}>Create church event</button>
            <button type="button" onClick={() => onNavigate('ministries')}>Manage ministries</button>
            <button type="button" onClick={() => onNavigate('groups')}>Manage Groups</button>
            <button type="button" onClick={() => onNavigate('people')}>Appoint leaders</button>
            <button type="button" onClick={() => onNavigate('people')}>Member approvals</button>
            <button type="button" onClick={onShowDetails}>Organization details</button>
          </div>

          <AdminCollection title="Announcements" description="Create, feature, edit, or remove church-wide announcements." items={home.announcements} type="announcement" onCreate={openEditor} onEdit={openEditor} onDelete={deleteItem} />
          <AdminCollection title="Acknowledgements" description="Only manually approved content appears to the church family." items={home.acknowledgements} type="acknowledgement" onCreate={openEditor} onEdit={openEditor} onDelete={deleteItem} />
          <AdminCollection title="Church events" description="Manage the activities displayed under Coming Up." items={home.events} type="event" onCreate={openEditor} onEdit={openEditor} onDelete={deleteItem} />
        </div>
      </details>

      {editor ? (
        <EditorDialog
          editor={editor}
          form={form}
          setForm={setForm}
          ministries={ministries}
          groups={groups}
          onClose={() => setEditor(null)}
          onSave={saveEditor}
        />
      ) : null}
    </section>
  );
}
