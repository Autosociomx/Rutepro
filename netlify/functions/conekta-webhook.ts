import { createHmac, timingSafeEqual } from 'crypto';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

// Validate Conekta webhook signature
function isValidSignature(body: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  try {
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    const sig = signature.replace(/^sha256=/, '');
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'));
  } catch {
    return false;
  }
}

// Get Google OAuth2 access token using service account JSON
async function getGoogleToken(saJson: string): Promise<string> {
  const sa = JSON.parse(saJson);
  const now = Math.floor(Date.now() / 1000);
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payloadB64 = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      sub: sa.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/datastore',
    })
  ).toString('base64url');

  const { createSign } = await import('crypto');
  const signer = createSign('RSA-SHA256');
  signer.update(`${headerB64}.${payloadB64}`);
  const sig = signer.sign(sa.private_key, 'base64url');
  const jwt = `${headerB64}.${payloadB64}.${sig}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const tokenData = (await tokenRes.json()) as any;
  if (!tokenData.access_token) throw new Error('No se pudo obtener token de Google');
  return tokenData.access_token;
}

// Activate user plan in Firestore via REST API
async function activateUserPlan(uid: string, projectId: string, token: string): Promise<void> {
  const now = Date.now();
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/usuarios/${uid}` +
    '?updateMask.fieldPaths=plan&updateMask.fieldPaths=billing';

  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        plan: { stringValue: 'active' },
        billing: {
          mapValue: {
            fields: {
              status: { stringValue: 'active' },
              activated_at: { integerValue: String(now) },
            },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Firestore PATCH failed: ${body}`);
  }
}

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const rawBody = event.body || '';

  // Signature validation (skip only if secret not configured)
  const webhookSecret = process.env.CONEKTA_WEBHOOK_SECRET;
  if (webhookSecret) {
    const sig = event.headers?.['digest'] || event.headers?.['x-conekta-signature'];
    if (!isValidSignature(rawBody, sig, webhookSecret)) {
      console.warn('Conekta webhook: firma inválida');
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Firma inválida' }) };
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'JSON inválido' }) };
  }

  const eventType: string = payload?.type || '';
  if (eventType !== 'charge.paid') {
    // Accept but ignore other event types
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, skipped: true }) };
  }

  const uid: string | undefined = payload?.data?.object?.metadata?.uid;
  if (!uid) {
    console.warn('Conekta webhook: uid no encontrado en metadata');
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, skipped: true }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const saJson = process.env.FIREBASE_SA_JSON;
  if (!projectId || !saJson) {
    console.error('Conekta webhook: FIREBASE_PROJECT_ID o FIREBASE_SA_JSON no configurados');
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Config de Firebase no disponible' }) };
  }

  try {
    const token = await getGoogleToken(saJson);
    await activateUserPlan(uid, projectId, token);
    console.log(`Plan activado para uid=${uid}`);
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
  } catch (err: any) {
    console.error('conekta-webhook error:', err?.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error al activar plan' }) };
  }
};
