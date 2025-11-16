import { flowGetStatus } from './flowClient.js';

const MAP = {
  1: 'PENDING',
  2: 'APPROVED',
  3: 'REJECTED',
  4: 'VOIDED'
};

export function normalizeFlow(data) {
  const status = MAP[data?.status] || 'UNKNOWN';
  return {
    status,
    amount: Number(data?.amount ?? 0),
    providerOrderId: String(data?.flowOrder ?? data?.commerceOrder ?? ''),
    authCode: data?.authorizationCode ?? '',
    raw: data
  };
}

export async function getStatusAndNormalize(token) {
  const raw = await flowGetStatus(token);
  return normalizeFlow(raw);
}
