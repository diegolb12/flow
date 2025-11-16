// api/subscriptions/start.js
import { flowCustomerCreate, flowCustomerRegister } from '../../src/lib/flowClient.js';
import { db } from '../../src/lib/db.js';
import { runCors } from '../../src/lib/cors.js'; // ajusta el nombre si es distinto

const BASE_URL = process.env.BASE_URL;           // ej: https://flow-lac-seven.vercel.app
const CARD_RETURN_PATH = '/api/subscriptions/card-return'; // callback después de registrar tarjeta

export default async function handler(req, res) {
  await runCors(req, res); // si tu cors se llama distinto, cámbialo

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    const {
      nombre,
      apellido,
      rut,
      email,
      telefono,
      region,
      comuna,
      planTipo // mensual/anual, etc. opcional
    } = body;

    if (!rut || !email || !nombre) {
      res.status(400).json({ ok: false, error: 'Faltan campos obligatorios' });
      return;
    }

    const fullName = `${nombre} ${apellido ?? ''}`.trim();
    const externalId = rut; // puedes usar tu propio ID interno si quieres

    // 1) ¿Ya existe cliente en tu DB?
    const existing = await db.query(
      'SELECT flow_customer_id FROM flow_customers WHERE external_id = $1 OR email = $2 LIMIT 1',
      [externalId, email]
    );

    let flowCustomerId;

    if (existing.rows.length > 0) {
      flowCustomerId = existing.rows[0].flow_customer_id;
    } else {
      // 2) Crear cliente en Flow
      const created = await flowCustomerCreate({
        name: fullName,
        email,
        externalId
      });

      flowCustomerId = created.customerId || created.customer_id;

      if (!flowCustomerId) {
        console.error('FLOW CUSTOMER CREATE SIN ID', created);
        res.status(500).json({ ok: false, error: 'No se obtuvo customerId desde Flow' });
        return;
      }

      // 3) Guardar cliente en tu DB
      await db.query(
        `INSERT INTO flow_customers (external_id, flow_customer_id, name, email, phone, region, comuna, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, NOW())`,
        [externalId, flowCustomerId, fullName, email, telefono ?? null, region ?? null, comuna ?? null]
      );
    }

    // 4) Solicitar registro de tarjeta
    const urlReturn = `${BASE_URL}${CARD_RETURN_PATH}`;
    const reg = await flowCustomerRegister({
      customerId: flowCustomerId,
      urlReturn
    });

    // reg debería tener { url, token }
    if (!reg.url || !reg.token) {
      console.error('FLOW CUSTOMER REGISTER MALFORMED', reg);
      res.status(500).json({ ok: false, error: 'Error al iniciar registro de tarjeta en Flow' });
      return;
    }

    // Puedes guardar el token como “pendiente” si quieres trazar el flujo
    await db.query(
      `INSERT INTO flow_customer_register_logs (flow_customer_id, token, created_at)
       VALUES ($1,$2,NOW())`,
      [flowCustomerId, reg.token]
    );

    res.status(200).json({
      ok: true,
      flowCustomerId,
      redirectUrl: reg.url,
      token: reg.token
    });
  } catch (err) {
    console.error('SUBSCRIPTIONS START ERROR', err);
    res.status(500).json({ ok: false, error: 'Error interno en start subscription' });
  }
}
