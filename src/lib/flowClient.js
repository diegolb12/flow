// /lib/flowClient.js
import { signParams } from './flowSign.js';
import { URLSearchParams } from 'url';

const BASE = process.env.FLOW_API_BASE;          // https://sandbox.flow.cl/api  | https://www.flow.cl/api
const API_KEY = process.env.FLOW_API_KEY;        // tu ApiKey
const SECRET = process.env.FLOW_SECRET;          // tu Secret (usado por signParams)

function formBody(params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.append(k, v ?? '');
  return body.toString();
}

export async function flowPaymentCreate(payload) {
  const params = {
    apiKey: API_KEY,
    commerceOrder: String(payload.commerceOrder),
    subject: String(payload.subject ?? ''),
    amount: String(payload.amount),
    email: String(payload.email ?? ''),
    urlConfirmation: String(payload.urlConfirmation),
    urlReturn: String(payload.urlReturn),
    paymentMethod: String(payload.paymentMethod ?? ''),
    optional: payload.optional ? JSON.stringify(payload.optional) : ''
  };
  const s = signParams(params, SECRET);
  const body = formBody({ ...params, s });

  const r = await fetch(`${BASE}/payment/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!r.ok) throw new Error(`flow create ${r.status}`);
  const data = await r.json(); // { token, url, flowOrder? }
  if (!data || !data.token || !data.url) throw new Error('flow create malformed response');
  return data;
}

export async function flowGetStatus(token) {
  const params = { apiKey: API_KEY, token: String(token) };
  const s = signParams(params, SECRET);
  const q = new URLSearchParams({ ...params, s }).toString();
  const r = await fetch(`${BASE}/payment/getStatus?${q}`, { method: 'GET' });
  if (!r.ok) throw new Error(`flow getStatus ${r.status}`);
  const data = await r.json();
  return data;
}

// opcional: refunds
export async function flowRefund(payload) {
  const params = {
    apiKey: API_KEY,
    flowTrxId: String(payload.flowTrxId),
    refundCommerceOrder: String(payload.refundCommerceOrder),
    amount: String(payload.amount ?? ''),
    receiverEmail: String(payload.receiverEmail ?? ''),
    optional: payload.optional ? JSON.stringify(payload.optional) : ''
  };
  const s = signParams(params, SECRET);
  const body = formBody({ ...params, s });
  const r = await fetch(`${BASE}/payment/refund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  if (!r.ok) throw new Error(`flow refund ${r.status}`);
  return r.json();
}
