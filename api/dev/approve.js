// /api/dev/approve.js
import { setCors, handleOptions } from '../../src/lib/cors.js';

export default async function handler(req, res) {
  setCors(res, req.headers.origin);
  if (handleOptions(req, res)) return;

  try {
    // Seguridad básica: requiere token admin por query o header
    const admin =
      req.headers['x-admin-token'] ||
      req.query?.admin ||
      req.body?.admin;
    if (admin !== process.env.DEV_ADMIN_TOKEN) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { reference } = req.body || {};
    if (!reference) return res.status(400).json({ error: 'reference required' });

    const { pool } = await import('../../src/lib/db.js');
    const { pushToHubspot } = await import('../../src/lib/hubspot.js');

    // 1) Traer orden
    const { rows } = await pool.query(
      `SELECT id, reference, email, amount, optional, fields, status
         FROM orders WHERE reference=$1`,
      [reference]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'order not found' });
    const order = rows[0];

    // 2) Marcar APPROVED + upsert pago simulado (idempotente simple)
    await pool.query(
      `UPDATE orders
          SET status='APPROVED',
              paid_at=NOW(),
              updated_at=NOW()
        WHERE reference=$1`,
      [reference]
    );

    await pool.query(
      `INSERT INTO payments (order_id, provider, provider_tx_id, amount, status, raw_payload)
         VALUES ($1, 'manual', 'DEV-'||to_char(NOW(),'YYYYMMDDHH24MISS'), $2, 'APPROVED', '{}'::jsonb)
         ON CONFLICT DO NOTHING`,
      [order.id, order.amount]
    );

    // 3) Empuje a HubSpot (solo una vez)
    await pushToHubspot({
      email: order.email,
      name: order.fields?.name || order.optional?.name || '',
      phone: order.fields?.phone || order.optional?.phone || '',
      region: order.fields?.region || order.optional?.region || '',
      comuna: order.fields?.comuna || order.optional?.comuna || '',
      rut: order.fields?.rut || order.optional?.rut || '',
      amount: Number(order.amount || 0),
      reference: order.reference,
      status: 'APPROVED'
    });

    return res.status(200).json({ ok: true, reference, pushedToHubspot: true });
  } catch (err) {
    console.error('dev/approve error:', err);
    return res.status(500).json({ error: err?.message || 'server error' });
  }
}
