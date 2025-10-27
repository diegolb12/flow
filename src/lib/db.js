import pkg from 'pg';
import { logger } from './logger.js';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export async function query(text, params) {
const start = Date.now();
const res = await pool.query(text, params);
logger.debug('db', text, params, `${Date.now()-start}ms`);
return res;
}
export async function upsertOrderByReference(data) {
const { reference, email, amount, optional, fields } = data;
const res = await query(
`INSERT INTO orders (reference, email, amount, raw_optional, name, rut, phone, region, comuna)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
ON CONFLICT (reference) DO UPDATE SET email=EXCLUDED.email, amount=EXCLUDED.amount, raw_optional=EXCLUDED.raw_optional
RETURNING *`,
[reference, email, amount, optional, fields?.name||null, fields?.rut||null, fields?.phone||null, fields?.region||null, fields?.comuna||null]
);
return res.rows[0];
}
export async function setOrderRedirected(reference, token, providerOrderId) {
await query(`UPDATE orders SET status='REDIRECTED', token=$2, provider_order_id=$3 WHERE reference=$1`, [reference, token, providerOrderId||null]);
}
export async function updateOrderStatusByToken(token, status, raw, amount, providerOrderId) {
await query(`UPDATE orders SET status=$2, raw_status=$3, provider_order_id=COALESCE($5, provider_order_id)
WHERE token=$1`, [token, status, raw, amount||null, providerOrderId||null]);
}
export async function insertPaymentOnce(provider, providerTxId, fields) {
try {
await query(
`INSERT INTO payments (order_id, provider, provider_tx_id, amount, auth_code, status, raw_payload)
VALUES ($1,$2,$3,$4,$5,$6,$7)`,
[fields.orderId||null, provider, providerTxId, fields.amount||null, fields.authCode||null, fields.status||null, fields.raw||null]
);
} catch (e) {
if (!String(e?.message||'').includes('ux_payments_provider_tx')) throw e;
}
}
export async function getOrderByReference(reference) {
const r = await query(`SELECT * FROM orders WHERE reference=$1`, [reference]);
return r.rows[0] || null;
}