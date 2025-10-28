// /api/checkout/create.js
import { flowPaymentCreate } from '../../src/lib/flowClient.js';
import { upsertOrderByReference, setOrderRedirected } from '../../src/lib/db.js';
import { setCors, handleOptions } from '../../src/lib/cors.js';

// corta a n chars
const clip = (s = '', n = 120) => String(s).slice(0, n);

// Solo enviar a Flow 1-2 claves cortas (ej. rut y empresa truncada)
function buildOptionalForFlow(opt = {}) {
  const rut = opt.rutPersonal || opt.rut || '';
  const empresa = opt.empresa || '';
  const mini = {};
  if (rut) mini.rut = clip(rut, 20);
  if (empresa) mini.emp = clip(empresa, 50);
  return mini; // => JSON muy pequeño
}

export default async function handler(req, res) {
  setCors(res, req.headers.origin);
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, optional = {} } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });

    const amount = 125000;
    const subject = 'subscripcion';
    const reference = `ORD-${Date.now()}-${Math.floor(Math.random() * 9000)}`;

    // Guardar TODO lo grande en tu BD
    await upsertOrderByReference({
      reference,
      email,
      amount,
      optional,           // <- aquí guardas el objeto completo
      fields: optional    // (tu esquema ya tiene jsonb)
    });

    // Solo mandar a Flow un optional pequeño
    const optionalForFlow = buildOptionalForFlow(optional);

    const resFlow = await flowPaymentCreate({
      commerceOrder: reference,
      subject,
      amount,
      email,
      urlConfirmation: `${process.env.PUBLIC_BASE_URL}/api/payments/notify`,
      urlReturn: `${process.env.PUBLIC_BASE_URL}/api/return`,
      paymentMethod: 9,
      optional: optionalForFlow
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
