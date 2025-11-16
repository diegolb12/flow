import { signParams } from './flowSign.js';
import { URLSearchParams } from 'url';

const BASE   = process.env.FLOW_API_BASE;
const API_KEY= process.env.FLOW_API_KEY;
const SECRET = process.env.FLOW_SECRET;

function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== '' && v !== null && v !== undefined) out[k] = v;
  }
  return out;
}

function formBody(params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.append(k, String(v));
  return body.toString();
}

export async function flowPaymentCreate(payload) {
  const baseParams = clean({
    apiKey: API_KEY,
    commerceOrder: String(payload.commerceOrder),
    subject: String(payload.subject ?? ''),
    amount: Number(payload.amount),
    email: String(payload.email ?? ''),
    urlConfirmation: String(payload.urlConfirmation),
    urlReturn: String(payload.urlReturn),
    optional: payload.optional ? JSON.stringify(payload.optional) : undefined
  });

  if (payload.paymentMethod != null) {
    baseParams.paymentMethod = String(payload.paymentMethod);
  }

  const s = signParams(baseParams, SECRET);
  const body = formBody({ ...baseParams, s });

  const r = await fetch(`${BASE}/payment/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept':'application/json' },
    body
  });

  const text = await r.text();

  if (!r.ok) {
    console.error('FLOW CREATE ERROR', r.status, text);
    throw new Error(`flow create ${r.status}`);
  }

  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!data?.token || !data?.url) {
    console.error('FLOW CREATE MALFORMED', data);
    throw new Error('flow create malformed response');
  }

  return data;
}

export async function flowGetStatus(token) {
  const params = { apiKey: API_KEY, token: String(token) };
  const s = signParams(params, SECRET);
  const q = new URLSearchParams({ ...params, s }).toString();

  const r = await fetch(`${BASE}/payment/getStatus?${q}`, { method: 'GET', headers:{'Accept':'application/json'} });
  const text = await r.text();
  if (!r.ok) {
    console.error('FLOW GETSTATUS ERROR', r.status, text);
    throw new Error(`flow getStatus ${r.status}`);
  }
  try { return JSON.parse(text); } catch { return { raw: text }; }
}
