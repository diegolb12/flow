// api/subscriptions/callback.js
import { signParams } from '../../src/lib/flowSign.js';
import { db } from '../../src/lib/db.js';
import { runCors } from '../../src/lib/cors.js';

const API_KEY = process.env.FLOW_API_KEY;
const SECRET  = process.env.FLOW_SECRET;

export default async function handler(req, res) {
  await runCors(req, res);

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false });
    return;
  }

  try {
    // Flow suele mandar x-www-form-urlencoded
    const data = typeof req.body === 'string'
      ? Object.fromEntries(new URLSearchParams(req.body))
      : req.body;

    // 1) separar firma
    const { s, ...rest } = data;

    // 2) validar firma
    const expected = signParams(rest, SECRET);
    if (!s || s !== expected) {
      console.error('FLOW SUBS CALLBACK FIRMA INVÁLIDA', { received: s, expected });
      res.status(400).json({ ok: false, error: 'invalid signature' });
      return;
    }

    // 3) leer campos relevantes (ajusta según payload real)
    const subscriptionId =
      rest.subscriptionId || rest.subscription_id || null;
    const invoiceId =
      rest.invoiceId || rest.invoice_id || null;
    const status = rest.status ?? null; // PAID, FAILED, etc.
    const amount = rest.amount ? Number(rest.amount) : null;

    // 4) guardar en DB
    if (invoiceId) {
      await db.query(
        `INSERT INTO flow_invoices
         (invoice_id, flow_subscription_id, status, amount, raw_payload, created_at)
         VALUES ($1,$2,$3,$4,$5,NOW())
         ON CONFLICT (invoice_id)
         DO UPDATE SET status = EXCLUDED.status,
                       amount = EXCLUDED.amount,
                       raw_payload = EXCLUDED.raw_payload,
                       updated_at = NOW()`,
        [invoiceId, subscriptionId, status, amount, JSON.stringify(rest)]
      );
    }

    // 5) actualizar estado de la suscripción (si aplica)
    if (subscriptionId) {
      await db.query(
        `UPDATE flow_subscriptions
         SET status = $1,
             updated_at = NOW()
         WHERE flow_subscription_id = $2`,
        [status, subscriptionId]
      );
    }

    // Aquí podrías también:
    //  - marcar al socio como "activo / moroso"
    //  - llamar a HubSpot para actualizar el contacto

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('FLOW SUBS CALLBACK ERROR', err);
    res.status(500).json({ ok: false });
  }
}
