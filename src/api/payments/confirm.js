import { getStatusAndNormalize } from '../../lib/flowStatus.js';
export default async function handler(req, res) {
  const token = (req.method === 'POST' ? req.body?.token : req.query?.token);
  if (!token) return res.status(400).json({ error: 'missing token' });
  try {
    const status = await getStatusAndNormalize(token);
    return res.status(200).json(status);
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'internal error' });
  }
}