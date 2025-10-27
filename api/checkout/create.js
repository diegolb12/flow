// /api/checkout/create.js
import { setCors, handleOptions } from '../src/lib/cors.js';

export default async function handler(req, res) {
  setCors(res, req.headers.origin);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // imports que podrían romper → aquí adentro
    const { flowPaymentCreate } = await import('../src/lib/flowClient.js');
    const { upsertOrderByReference, setOrderRedirected } = await import('../src/lib/db.js');

    const { email, optional } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });

    const amount = 125000;
    const subject = 'subscripcion';
    const reference = `ORD-${Date.now()}-${Math.floor(Math.random() * 9000)}`;

    await upsertOrderByReference({
      reference, email, amount,
      optional: optional || {}, fields: optional || {}
    });

    const resFlow = await flowPaymentCreate({
      commerceOrder: reference,
      subject,
      amount,
      email,
      urlConfirmation: `${process.env.PUBLIC_BASE_URL}/api/payments/notify`,
      urlReturn:       `${process.env.PUBLIC_BASE_URL}/gracias.html`,
      paymentMethod: 9,
      optional: optional || {}
    });

    await setOrderRedirected(reference, resFlow.token, String(resFlow.flowOrder ?? ''));

    return res.status(200).json({
      redirectUrl: `${resFlow.url}?token=${resFlow.token}`,
      token: resFlow.token
    });
  } catch (err) {
    console.error('checkout/create error:', err);
    return res.status(500).json({ error: err?.message || 'internal error' });
  }
}
