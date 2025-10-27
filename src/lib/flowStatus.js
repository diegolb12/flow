import { flowGetStatus } from './flowClient.js';
export async function getStatusAndNormalize(token) {
  const data = await flowGetStatus(token);
  const map = { 1: 'PENDING', 2: 'APPROVED', 3: 'REJECTED', 4: 'VOIDED' };
  return {
    token,
    provider: 'flow',
    providerOrderId: String(data.flowOrder ?? data.flowTrxId ?? ''),
    status: map[data.status],
    amount: Number(data.amount ?? 0),
    authCode: data.paymentData?.authorizationCode ?? null,
    raw: data,
  };
}