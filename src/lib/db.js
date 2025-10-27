// /lib/db.js
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  ssl: { rejectUnauthorized: false }
});

export async function query(text, params) {
  const client = await pool.connect();
  try { return await client.query(text, params); }
  finally { client.release(); }
}

// Guarda/actualiza orden por reference (status inicial = CREATED)
export async function upsertOrderByReference({ reference, email, amount, optional, fields }) {
  return query(`
    INSERT INTO orders (reference, email, amount, status, fields, created_at)
    VALUES ($1,$2,$3,'CREATED',$4, NOW())
    ON CONFLICT (reference)
    DO UPDATE SET email=EXCLUDED.email, amount=EXCLUDED.amount, fields=EXCLUDED.fields
    RETURNING id
  `, [reference, email, amount, fields || optional || {}]);
}

// Guarda token/flowOrder al ser creada la orden en Flow
export async function setOrderRedirected(reference, token, providerOrderId) {
  return query(`
    UPDATE orders SET token=$2, provider_order_id=$3, status='REDIRECTED', updated_at=NOW()
    WHERE reference=$1
  `, [reference, token, providerOrderId || null]);
}

// Idempotente: (provider, provider_order_id) único
export async function insertPaymentOnce(provider, providerOrderId, { orderId, amount, authCode, status, raw }) {
  return query(`
    INSERT INTO payments (provider, provider_order_id, order_id, amount, auth_code, status, raw, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())
    ON CONFLICT (provider, provider_order_id) DO NOTHING
  `, [provider, providerOrderId, orderId, amount, authCode, status, raw]);
}

// Actualiza estado/amount/provider_order_id por token
export async function updateOrderStatusByToken(token, status, rawStatus, amount, providerOrderId) {
  return query(`
    UPDATE orders
    SET status=$2, raw_status=$3, amount=$4, provider_order_id=COALESCE($5, provider_order_id), updated_at=NOW()
    WHERE token=$1
  `, [token, status, rawStatus, amount, providerOrderId || null]);
}
