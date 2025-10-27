import { getOrderByReference } from '../../lib/db.js';
export default async function handler(req, res) {
  const { reference } = req.query;
  if (!reference) return res.status(400).json({ error: 'missing reference' });
  const order = await getOrderByReference(reference);
  if (!order) return res.status(404).json({ error: 'not found' });
  return res.status(200).json(order);
}