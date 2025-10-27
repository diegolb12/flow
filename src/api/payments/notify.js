import { getStatusAndNormalize } from '../../lib/flowStatus.js';
import { insertPaymentOnce, updateOrderStatusByToken, query } from '../../lib/db.js';
import querystring from 'querystring';

async function readBody(req) {
  if (typeof req.body === 'string') {
    const ct = (req.headers['content-type'] || '').toLowerCase();
    if (ct.includes('application/x-www-form-urlencoded')) return querystring.parse(req.body);
    if (ct.includes('application/json')) return JSON.parse(req.body);
    return { raw: req.body };
  }
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const ch of req) chunks.push(Buffer.from(ch));
  const raw = Buffer.concat(chunks).toString('utf8');
  const ct = (req.headers['content-type'] || '').toLowerCase();
  if (ct.includes('application/x-www-form-urlencoded')) return querystring.parse(raw);
  if (ct.includes('application/json')) return JSON.parse(raw);
  return { raw };
}

export default async function handler(req, res) {
  try {
    const body = await readBody(req);
    const token = body?.token || req.query?.token;
    if (!token) return res.status(400).send('missing token');
    const status = await getStatusAndNormalize(token);
    const orderRow = await query(`SELECT id, reference, email, amount FROM orders WHERE token=$1`, [token]);
    const order = orderRow.rows[0];
    await insertPaymentOnce('flow', status.providerOrderId || token, {
      orderId: order?.id, amount: status.amount, authCode: status.authCode, status: status.status, raw: status.raw
    });
    await updateOrderStatusByToken(token, status.status, status.raw, status.amount, status.providerOrderId);
  } catch (e) {
    // log opcional
  }
  return res.status(200).send('OK');
}