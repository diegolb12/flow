import { createHmac } from 'crypto';
export function signParams(params) {
const keys = Object.keys(params).sort();
const toSign = keys.map(k => `${k}${params[k]}`).join('');
return createHmac('sha256', process.env.FLOW_SECRET).update(toSign).digest('hex');
}