// api/subscriptions/start.js
import { flowCustomerCreate, flowCustomerRegister } from '../../src/lib/flowClient.js';
import { query } from '../../src/lib/db.js';
import { setCors, handleOptions } from '../../src/lib/cors.js';

const BASE_URL = process.env.BASE_URL;
const CARD_RETURN_PATH = '/api/subscriptions/card-return';

export default async function handler(req, res) {
  // CORS – igual que tus endpoints antiguos
  if (handleOptions(req, res)) return;
  setCors(res, req.headers.origin);

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
      empresa,
      tipoRut,
      rutPersonal,
      rutEmpresa,
      genero,
      empleados,
      rubro
    } = body;

    if (!rut || !email || !nombre) {
      res.status(400).json({ ok: false, error: 'Faltan campos obligatorios (nombre, rut, email)' });
      return;
    }

    const fullName = `${nombre} ${apellido ?? ''}`.trim();
    const externalId = rut;

    // 1) ¿Ya existe cliente?
    const existing = await query(
      'SELECT flow_customer_id FROM flow_customers WHERE external_id = $1 OR email = $2 LIMIT 1',
      [externalId, email]
    );

    let flowCustomerId;

    if (existing.rows.length > 0) {
      flowCustomerId = existing.rows[0].flow_customer_id;
    } else {
      // 2) Crear cliente en Flow
      const created = await flowCustomerCreate({
        name: fullName || empresa || email,
        email,
        externalId
      });

      flowCustomerId = created.customerId || created.customer_id;

      if (!flowCustomerId) {
        console.error('FLOW CUSTOMER CREATE SIN ID', created);
        res.status(500).json({ ok: false, error: 'No se obtuvo customerId desde Flow' });
        return;
      }

      // 3) Guardar cliente en DB
      await query(
        `INSERT INTO flow_customers
           (external_id, flow_customer_id, name, email, phone, region, comuna,
            empresa, tipo_rut, rut_personal, rut_empresa, genero, empleados, rubro,
            created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())`,
        [
          externalId,
          flowCustomerId,
          fullName || null,
          email,
          telefono ?? null,
          region ?? null,
          comuna ?? null,
          empresa ?? null,
          tipoRut ?? null,
          rutPersonal ?? null,
          rutEmpresa ?? null,
          genero ?? null,
          empleados ?? null,
          rubro ?? null
        ]
      );
    }

    // 4) Registro de tarjeta
    const urlReturn = `${BASE_URL}${CARD_RETURN_PATH}`;
    const reg = await flowCustomerRegister({
      customerId: flowCustomerId,
      urlReturn
    });

    if (!reg.url || !reg.token) {
      console.error('FLOW CUSTOMER REGISTER MALFORMED', reg);
      res.status(500).json({ ok: false, error: 'Error al iniciar registro de tarjeta en Flow' });
      return;
    }

    await query(
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
