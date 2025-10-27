// /api/payments/confirm.js
import { setCors, handleOptions } from '../../src/lib/cors.js';

export default async function handler(req, res) {
  setCors(res, req.headers.origin);
  if (handleOptions(req, res)) return;

  const token = req.query?.token || req.body?.token;
  if (!token) return res.status(400).json({ error: 'token required' });

  try {
    // ⚠️ Importa SOLO desde src/lib con profundidad correcta
    const { flowGetStatus } = await import('../../src/lib/flowClient.js');
    const { upsertOrderByReference } = await import('../../src/lib/db.js');

    // 1) Pregunta a Flow por el token
    const st = await flowGetStatus(token);  // devuelve status, commerceOrder, amount, etc.
    const reference = String(st.commerceOrder || st.order || '');
    const amount = Number(st.amount || 0);
    const status = String(st.status || '').toUpperCase();

    // 2) Persistir/actualizar orden (simple y seguro)
    await upsertOrderByReference({
      reference,
      email: st.payer || '',
      amount,
      optional: { raw_status: st },
      fields: {}
    });

    // 3) Responder SIEMPRE JSON
    return res.status(200).json({
      status,
      reference,
      amount,
      providerOrderId: st.flowOrder || st.providerOrderId || '',
      raw: st
    });
  } catch (err) {
    console.error('payments/confirm error:', err);
    return res.status(500).json({ error: err?.message || 'server error' });
  }
}
