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

/* =========================
 * PAGO UNICO
 * ========================= */

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
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept':'application/json'
    },
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

  const r = await fetch(`${BASE}/payment/getStatus?${q}`, {
    method: 'GET',
    headers:{ 'Accept':'application/json' }
  });

  const text = await r.text();
  if (!r.ok) {
    console.error('FLOW GETSTATUS ERROR', r.status, text);
    throw new Error(`flow getStatus ${r.status}`);
  }
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

/* =========================
 * SUSCRIPCIONES
 * ========================= */

/**
 * Crea un cliente en Flow (customer/create).
 * Requiere: name, email, externalId.
 */
export async function flowCustomerCreate({ name, email, externalId }) {
  const baseParams = clean({
    apiKey: API_KEY,
    name: String(name),
    email: String(email),
    externalId: String(externalId)
  });

  const s = signParams(baseParams, SECRET);
  const body = formBody({ ...baseParams, s });

  const r = await fetch(`${BASE}/customer/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body
  });

  const text = await r.text();
  if (!r.ok) {
    console.error('FLOW CUSTOMER CREATE ERROR', r.status, text);
    throw new Error(`flow customer create ${r.status}`);
  }

  try { return JSON.parse(text); } catch { return { raw: text }; }
}

/**
 * Envía a un cliente a registrar su tarjeta (customer/register).
 * Requiere: customerId, urlReturn (tu endpoint que recibirá el token).
 */
export async function flowCustomerRegister({ customerId, urlReturn }) {
  const baseParams = clean({
    apiKey: API_KEY,
    customerId: String(customerId),
    // OJO: en la API es "url_return" con guion bajo
    url_return: String(urlReturn)
  });

  const s = signParams(baseParams, SECRET);
  const body = formBody({ ...baseParams, s });

  const r = await fetch(`${BASE}/customer/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body
  });

  const text = await r.text();
  if (!r.ok) {
    console.error('FLOW CUSTOMER REGISTER ERROR', r.status, text);
    throw new Error(`flow customer register ${r.status}`);
  }

  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!data?.token || !data?.url) {
    console.error('FLOW CUSTOMER REGISTER MALFORMED', data);
    throw new Error('flow customer register malformed response');
  }

  return data; // { url, token }
}

/**
 * Obtiene el resultado del registro de tarjeta (customer/getRegisterStatus).
 * Se usa en tu url_return capturando el token.
 */
export async function flowCustomerGetRegisterStatus(token) {
  const params = clean({
    apiKey: API_KEY,
    token: String(token)
  });

  const s = signParams(params, SECRET);
  const q = new URLSearchParams({ ...params, s }).toString();

  const r = await fetch(`${BASE}/customer/getRegisterStatus?${q}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });

  const text = await r.text();
  if (!r.ok) {
    console.error('FLOW CUSTOMER GETREGISTERSTATUS ERROR', r.status, text);
    throw new Error(`flow customer getRegisterStatus ${r.status}`);
  }

  try { return JSON.parse(text); } catch { return { raw: text }; }
}

/* =========================
 * SUSCRIPCIONES
 * ========================= */

/**
 * Crea una suscripción a un plan (subscription/create).
 * Requiere: planId, customerId.
 * Opcionales: subscriptionStart (yyyy-mm-dd), couponId, trialPeriodDays,
 *             periodsNumber, planAdditionalList (array de ids numéricos).
 */
export async function flowSubscriptionCreate(payload) {
  const baseParams = clean({
    apiKey: API_KEY,
    planId: String(payload.planId),
    customerId: String(payload.customerId),
    subscription_start: payload.subscriptionStart
      ? String(payload.subscriptionStart)
      : undefined,
    couponId: payload.couponId != null
      ? Number(payload.couponId)
      : undefined,
    trial_period_days: payload.trialPeriodDays != null
      ? Number(payload.trialPeriodDays)
      : undefined,
    periods_number: payload.periodsNumber != null
      ? Number(payload.periodsNumber)
      : undefined,
    // Lo enviamos como JSON string (lista de números)
    planAdditionalList:
      Array.isArray(payload.planAdditionalList) &&
      payload.planAdditionalList.length > 0
        ? JSON.stringify(payload.planAdditionalList)
        : undefined
  });

  const s = signParams(baseParams, SECRET);
  const body = formBody({ ...baseParams, s });

  const r = await fetch(`${BASE}/subscription/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body
  });

  const text = await r.text();
  if (!r.ok) {
    console.error('FLOW SUBSCRIPTION CREATE ERROR', r.status, text);
    throw new Error(`flow subscription create ${r.status}`);
  }

  try { return JSON.parse(text); } catch { return { raw: text }; }
}
