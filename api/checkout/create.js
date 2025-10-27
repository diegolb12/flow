// /api/checkout/create.js
import { flowPaymentCreate } from '../../lib/flowClient.js';
import { upsertOrderByReference, setOrderRedirected } from '../../lib/db.js';
import { setCors, handleOptions } from '../../lib/cors.js';

function allowCors(res, origin = '') {
  // Si quieres whitelist: reemplaza '*' por tu dominio Webflow (p. ej. https://tu-site.webflow.io)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
    setCors(res, req.headers.origin);
    if (handleOptions(req, res)) return;
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, optional } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });

    // 🧷 Valores SEGURIZADOS en backend (no editables desde el front)
    const amount = 125000;                // CLP fijo
    const subject = 'subscripcion';       // asunto fijo
    const reference = `ORD-${Date.now()}-${Math.floor(Math.random() * 9000)}`;

    // Guarda orden inicial en DB
    await upsertOrderByReference({
      reference,
      email,
      amount,
      optional: optional || {},
      fields: optional || {}
    });

    // Crea orden de pago en Flow
    const resFlow = await flowPaymentCreate({
      commerceOrder: reference,
      subject,
      amount,
      email,
      urlConfirmation: `${process.env.PUBLIC_BASE_URL}/api/payments/notify`,
      urlReturn: `${process.env.PUBLIC_BASE_URL}/api/return`,
      paymentMethod: 9,
      optional: optional || {}
    });

    // Persistir token / flowOrder
    await setOrderRedirected(reference, resFlow.token, String(resFlow.flowOrder ?? ''));

    // Entregar URL de redirección al checkout
    return res.status(200).json({
      redirectUrl: `${resFlow.url}?token=${resFlow.token}`,
      token: resFlow.token
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err?.message || 'internal error' });
  }
}
