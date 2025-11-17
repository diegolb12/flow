// api/subscriptions/card-return.js
import {
  flowCustomerGetRegisterStatus,
  flowSubscriptionCreate
} from '../../src/lib/flowClient.js';
import { query } from '../../src/lib/db.js';
import { setCors, handleOptions } from '../../src/lib/cors.js';

const PLAN_ID = process.env.FLOW_PLAN_ID;
const SUCCESS_REDIRECT = process.env.SUBS_SUCCESS_URL || 'https://www.asech.cl/gracias-suscripcion';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res, req.headers.origin);

  try {
    const status = await flowCustomerGetRegisterStatus(token);

    const flowCustomerId = status.customerId || status.customer_id;
    const payMode       = status.payMode || status.pay_mode || null;
    const last4         = status.last4CardDigits || status.last4 || null;
    const cardStatus    = status.status || status.cardStatus || null;

    if (flowCustomerId) {
      await query(
        `UPDATE flow_customers
         SET card_registered = true,
             pay_mode = $1,
             last4 = $2,
             card_status = $3,
             updated_at = NOW()
         WHERE flow_customer_id = $4`,
        [payMode, last4, cardStatus, flowCustomerId]
      );
    }

    if (!PLAN_ID || !flowCustomerId) {
      console.error('Falta PLAN_ID o flowCustomerId para crear suscripción');
    } else {
      const subscription = await flowSubscriptionCreate({
        planId: PLAN_ID,
        customerId: flowCustomerId
      });

      const flowSubscriptionId =
        subscription.subscriptionId || subscription.subscription_id;

      if (flowSubscriptionId) {
        await query(
          `INSERT INTO flow_subscriptions
             (flow_subscription_id, flow_customer_id, status,
              subscription_start, subscription_end,
              period_start, period_end, next_invoice_date, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())`,
          [
            flowSubscriptionId,
            flowCustomerId,
            subscription.status ?? null,
            subscription.subscription_start ?? null,
            subscription.subscription_end ?? null,
            subscription.period_start ?? null,
            subscription.period_end ?? null,
            subscription.next_invoice_date ?? null
          ]
        );
      }
    }

    res.writeHead(302, { Location: SUCCESS_REDIRECT });
    res.end();
  } catch (err) {
    console.error('CARD RETURN ERROR', err);
    res.writeHead(302, { Location: `${SUCCESS_REDIRECT}?error=1` });
    res.end();
  }
}
