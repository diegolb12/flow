// src/lib/cors.js

// Agrega aquí tus dominios permitidos:
const BASE_ORIGINS = [
  'https://www.asech.cl',               // producción
  'https://flow-lac-seven.vercel.app', // backend vercel
];

function isAllowedWebflowDomain(origin = '') {
  // permite cualquier dominio *.webflow.io
  return origin.endsWith('.webflow.io');
}

export function setCors(res, originHeader = '') {
  let allow = BASE_ORIGINS[0];

  if (BASE_ORIGINS.includes(originHeader)) {
    allow = originHeader;
  } else if (isAllowedWebflowDomain(originHeader)) {
    allow = originHeader; // ← habilita Webflow (staging o custom)
  }

  res.setHeader('Access-Control-Allow-Origin', allow);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

export function handleOptions(req, res) {
  if (req.method === 'OPTIONS') {
    // Importante: incluir CORS también en OPTIONS
    setCors(res, req.headers.origin);
    res.status(204).end();
    return true;
  }
  return false;
}
