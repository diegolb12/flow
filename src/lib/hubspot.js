// src/lib/hubspot.js
const HUBSPOT_BASE = process.env.HUBSPOT_BASE || 'https://api.hubapi.com';
const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN; // App privada: scopes contacts.read + contacts.write

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
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.message || data?.detail || text || `HTTP ${res.status}`;
    throw new Error(`HubSpot ${path} -> ${res.status}: ${msg}`);
  }
  return data;
}

async function findContactByEmail(email) {
  const payload = {
    filterGroups: [{ filters: [{ propertyName: 'email', operator: 'EQ', value: email }] }],
    properties: ['email','firstname','lastname','phone'],
    limit: 1
  };
  const data = await hsFetch('/crm/v3/objects/contacts/search', { method: 'POST', body: JSON.stringify(payload) });
  return (data.results && data.results[0]) || null;
}

function splitName(fullname = '') {
  const s = String(fullname || '').trim();
  if (!s) return { firstname: '', lastname: '' };
  const parts = s.split(/\s+/);
  return { firstname: parts.shift() || '', lastname: parts.join(' ') };
}

async function createContact({ email, name, phone }) {
  const { firstname, lastname } = splitName(name);
  return hsFetch('/crm/v3/objects/contacts', {
    method: 'POST',
    body: JSON.stringify({ properties: { email, firstname, lastname, phone } })
  });
}

async function updateContact(id, { email, name, phone }) {
  const { firstname, lastname } = splitName(name);
  return hsFetch(`/crm/v3/objects/contacts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties: { email, firstname, lastname, phone } })
  });
}

/**
 * Upsert de contacto por email (sin notas)
 * payload: { email (req), name?, phone? ...otros campos ignorados }
 */
export async function pushToHubspot(payload) {
  if (!HUBSPOT_TOKEN) {
    console.warn('HubSpot push NOOP: HUBSPOT_TOKEN no definido');
    return { ok: false, noop: true };
  }
  const email = String(payload.email || '').trim();
  if (!email) throw new Error('pushToHubspot: email requerido');

  const baseData = { email, name: payload.name || '', phone: payload.phone || '' };
  const existing = await findContactByEmail(email);
  const contact = existing ? await updateContact(existing.id, baseData) : await createContact(baseData);
  return { ok: true, contactId: contact.id };
}

export default pushToHubspot;
