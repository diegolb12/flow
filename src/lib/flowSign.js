import crypto from 'crypto';

export function signParams(params, secret = process.env.FLOW_SECRET) {
  const keys = Object.keys(params).sort();
  const toSign = keys.map(k => `${k}${params[k] ?? ''}`).join('');
  return crypto.createHmac('sha256', secret).update(toSign).digest('hex');
}
