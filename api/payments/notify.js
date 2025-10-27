// /api/payments/notify.js
import { getStatusAndNormalize } from '../../lib/flowStatus.js';
import { query, insertPaymentOnce, updateOrderStatusByToken } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    const token = req.body?.token || req.query?.token;
    if (!token) return res.status(400).send('missing token');

    // 1) Fuente de verdad: Flow
    const status = await getStatusAndNormalize(token); // { status, amount, providerOrderId, authCode, raw }

    // 2) Orden local
    const r = await query('SELECT id, reference, amount FROM orders WHERE token=$1', [token]);
    const order = r.rows[0];

    // 3) Validación dura de monto
    if (order && Number(order.amount) !== Number(status.amount)) {
      await query('UPDATE orders SET status=$2, raw_status=$3 WHERE token=$1', [
        token, 'AMOUNT_MISMATCH', status.raw
      ]);
      // Respondemos 200 para que Flow no reintente indefinidamente
      return res.status(200).send('OK');
    }

    // 4) Registro idempotente del pago
    await insertPaymentOnce('flow', status.providerOrderId || token, {
      orderId: order?.id ?? null,
      amount: status.amount,
      authCode: status.authCode || null,
      status: status.status,
      raw: status.raw
    });

    // 5) Actualiza estado de la orden
    await updateOrderStatusByToken(token, status.status, status.raw, status.amount, status.providerOrderId || null);
  } catch (e) {
    console.error('[notify] error:', e);
    // Igual respondemos 200 para que Flow no haga flood de reintentos; el error quedará logueado
  }
  return res.status(200).send('OK');
}
