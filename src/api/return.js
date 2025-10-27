export default async function handler(req, res) {
    const token = req.method === 'POST' ? req.body?.token : req.query?.token;
    const dest = token
      ? `/gracias.html?token=${encodeURIComponent(token)}`
      : `/gracias.html?err=missing_token`;
  
    return res.status(302).setHeader('Location', dest).end();
  }
  