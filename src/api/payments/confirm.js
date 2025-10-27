import { getStatusAndNormalize } from '../../lib/flowStatus.js';

function allowCors(res, origin = '') {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  allowCors(res, req.headers.origin || '');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.query?.token;
  if (!token) return res.status(400).json({ error: 'token required' });

  try {
    const data = await getStatusAndNormalize(token);
    return res.status(200).json(data); // {status, amount, providerOrderId, authCode, raw}
  } catch (e) {
    console.error('[confirm] error:', e);
    return res.status(500).json({ error: 'internal error' });
  }
}
