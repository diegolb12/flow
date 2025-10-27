// /lib/cors.js
const ALLOW_ORIGINS = [
    'https://www.asech.cl',  // página pública donde vive el formulario
    'https://flow-lac-seven.vercel.app', // tu propio dominio (útil para pruebas)
  ];
  
  export function setCors(res, originHeader) {
    const origin = originHeader || '';
    const allow = ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
    res.setHeader('Access-Control-Allow-Origin', allow);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Si alguna vez usas cookies: res.setHeader('Access-Control-Allow-Credentials','true');
  }
  
  export function handleOptions(req, res) {
    if (req.method === 'OPTIONS') {
      res.status(204).end(); // preflight OK
      return true;
    }
    return false;
  }
  