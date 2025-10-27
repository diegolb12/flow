import { upsertOrderByReference, setOrderRedirected } from '../../lib/db.js';
import { flowPaymentCreate } from '../../lib/flowClient.js';

function allowCors(res, origin) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  allowCors(res, req.headers.origin || '');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { reference, amount, email, optional } = req.body || {};
    if (!reference || !amount || !email) return res.status(400).json({ error: 'reference, amount, email required' });
    const fields = optional ? (typeof optional === 'string' ? JSON.parse(optional) : optional) : {};
    await upsertOrderByReference({ reference, email, amount, optional: fields, fields });
    const resFlow = await flowPaymentCreate({
      commerceOrder: reference,
      subject: fields?.subject || `Orden ${reference}`,
      amount: Number(amount),
      email,
      urlConfirmation: `${process.env.PUBLIC_BASE_URL}/api/payments/notify`,
      urlReturn: `${process.env.PUBLIC_BASE_URL}/api/return`,
      paymentMethod: 9,
      optional: fields,
    });
    await setOrderRedirected(reference, resFlow.token, String(resFlow.flowOrder ?? ''));
    return res.status(200).json({
      redirectUrl: `${resFlow.url}?token=${resFlow.token}`,
      token: resFlow.token,
      providerOrderId: resFlow.flowOrder || null,
    });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'internal error' });
  }
}