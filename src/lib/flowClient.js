import querystring from 'querystring';
import { signParams } from './flowSign.js';
const FLOW_API_BASE = process.env.FLOW_API_BASE;
const FLOW_API_KEY = process.env.FLOW_API_KEY;
export async function flowPaymentCreate(payload) {
  const params = {
    apiKey: FLOW_API_KEY,
    commerceOrder: payload.commerceOrder,
    subject: payload.subject,
    amount: payload.amount,
    email: payload.email,
    urlConfirmation: payload.urlConfirmation,
    urlReturn: payload.urlReturn,
  };
  if (payload.paymentMethod) params.paymentMethod = payload.paymentMethod;
  if (payload.optional) params.optional = JSON.stringify(payload.optional);
  const s = signParams(params);
  const body = querystring.stringify({ ...params, s });
  const r = await fetch(`${FLOW_API_BASE}/payment/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
  });
  if (!r.ok) throw new Error(`flowPaymentCreate failed: ${r.status} ${await r.text()}`);
  return r.json(); // { url, token, flowOrder }
}
export async function flowGetStatus(token) {
  const params = { apiKey: FLOW_API_KEY, token };
  const s = signParams(params);
  const q = new URLSearchParams({ ...params, s }).toString();
  const r = await fetch(`${FLOW_API_BASE}/payment/getStatus?${q}`);
  if (!r.ok) throw new Error(`flowGetStatus failed: ${r.status} ${await r.text()}`);
  return r.json();
}
export async function flowRefund(payload) {
  const params = {
    apiKey: FLOW_API_KEY,
    refundCommerceOrder: payload.refundCommerceOrder,
    receiverEmail: payload.receiverEmail,
    amount: payload.amount,
  };
  if (payload.flowTrxId) params.flowTrxId = Number(payload.flowTrxId);
  if (payload.commerceTrxId) params.commerceTrxId = payload.commerceTrxId;
  if (payload.urlCallBack) params.urlCallBack = payload.urlCallBack;
  const s = signParams(params);
  const body = querystring.stringify({ ...params, s });
  const r = await fetch(`${FLOW_API_BASE}/payment/refund`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
  });
  if (!r.ok) throw new Error(`flowRefund failed: ${r.status} ${await r.text()}`);
  return r.json();
}