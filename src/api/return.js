export default async function handler(req, res) {
    const token = (req.method === 'POST' ? req.body?.token : req.query?.token);
    if (!token) return res.status(302).setHeader('Location', '/thanks.html?err=missing_token').end();
    res.status(302).setHeader('Location', `/gracias.html?token=${encodeURIComponent(token)}`).end();
  }