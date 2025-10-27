// src/lib/hubspot.js
const HUBSPOT_BASE = process.env.HUBSPOT_BASE || 'https://api.hubapi.com';
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN; // Token de App Privada (scopes: crm.objects.contacts.read/write, crm.objects.notes.write)

if (!HUBSPOT_TOKEN) {
  console.warn('HUBSPOT_TOKEN no está definido; pushToHubspot hará NOOP.');
}

async function hsFetch(path, opts = {}) {
  const res = await fetch(`${HUBSPOT_BASE}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(opts.headers || {})
    }
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.message || data?.detail || text || `HTTP ${res.status}`;
    throw new Error(`HubSpot ${path} -> ${res.status}: ${msg}`);
  }
  return data;
}

async function findContactByEmail(email) {
  const payload = {
    filterGroups: [{
      filters: [{ propertyName: 'email', operator: 'EQ', value: email }]
    }],
    properties: ['email', 'firstname', 'lastname', 'phone'],
    limit: 1
  };
  const data = await hsFetch('/crm/v3/objects/contacts/search', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return (data.results && data.results[0]) || null;
}

function splitName(fullname = '') {
  const s = String(fullname || '').trim();
  if (!s) return { firstname: '', lastname: '' };
  const parts = s.split(/\s+/);
  const firstname = parts.shift() || '';
  const lastname = parts.length ? parts.join(' ') : '';
  return { firstname, lastname };
}

async function createContact({ email, name, phone }) {
  const { firstname, lastname } = splitName(name);
  return hsFetch('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({
      properties: { email, firstname, lastname, phone }
    })
  });
}

async function updateContact(id, { email, name, phone }) {
  const { firstname, lastname } = splitName(name);
  return hsFetch(`/crm/v3/objects/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      properties: { email, firstname, lastname, phone }
    })
  });
}

async function createNote({ contactId, note }) {
  // Crea una nota y la asocia al contacto
  const noteRes = await hsFetch('/crm/v3/objects/notes', {
    method: 'POST',
    body: JSON.stringify({
      properties: { hs_note_body: note }
    })
  });
  const noteId = noteRes.id;
  // Asociar nota ↔ contacto
  await hsFetch(`/crm/v4/objects/notes/${noteId}/associations/contacts/${contactId}`, {
    method: 'PUT',
    body: JSON.stringify([{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 280 }]) // note_to_contact
  });
  return noteRes;
}

/**
 * pushToHubspot(payload)
 * payload: {
 *  email (req), name?, phone?, region?, comuna?, rut?, amount?, reference?, status?
 * }
 */
export async function pushToHubspot(payload) {
  if (!HUBSPOT_TOKEN) {
    console.warn('HubSpot push NOOP: HUBSPOT_TOKEN no definido');
    return { ok: false, noop: true };
  }
  const email = String(payload.email || '').trim();
  if (!email) throw new Error('pushToHubspot: email requerido');

  const baseData = {
    email,
    name: payload.name || '',
    phone: payload.phone || ''
  };

  // Upsert contacto
  const existing = await findContactByEmail(email);
  const contact = existing
    ? await updateContact(existing.id, baseData)
    : await createContact(baseData);

  // Nota con datos adicionales (no falla si no tienes custom properties)
  const lines = [];
  if (payload.reference) lines.push(`Referencia: ${payload.reference}`);
  if (payload.amount != null) lines.push(`Monto: ${payload.amount}`);
  if (payload.status) lines.push(`Estado: ${payload.status}`);
  if (payload.rut) lines.push(`RUT: ${payload.rut}`);
  if (payload.region) lines.push(`Región: ${payload.region}`);
  if (payload.comuna) lines.push(`Comuna: ${payload.comuna}`);
  const noteText = lines.length ? lines.join('\n') : 'Pago aprobado (detalle adjunto).';

  await createNote({ contactId: contact.id, note: noteText });

  return { ok: true, contactId: contact.id };
}

export default pushToHubspot;
