const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const conektaKey = process.env.CONEKTA_PRIVATE_KEY;
  if (!conektaKey) {
    return {
      statusCode: 503,
      headers: CORS,
      body: JSON.stringify({ error: 'Pago no disponible aún. Contáctanos a hola@rutepro.mx para activar tu cuenta.' }),
    };
  }

  let uid: string, email: string, nombre: string;
  try {
    ({ uid, email, nombre } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Cuerpo inválido' }) };
  }

  if (!uid || !email) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'uid y email son requeridos' }) };
  }

  const expiresAt = Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60; // 3 days

  const orderPayload = {
    currency: 'MXN',
    customer_info: {
      name: nombre || 'Cliente RoutePro',
      email,
      phone: '+5200000000',
    },
    line_items: [
      {
        name: 'RoutePro — Plan Mensual',
        unit_price: 29900, // centavos
        quantity: 1,
      },
    ],
    charges: [
      {
        payment_method: {
          type: 'cash',
          expires_at: expiresAt,
        },
      },
    ],
    metadata: { uid, source: 'rutepro_paywall' },
  };

  try {
    const res = await fetch('https://api.conekta.io/orders', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${conektaKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.conekta-v2.1.0+json',
        'Accept-Language': 'es',
      },
      body: JSON.stringify(orderPayload),
    });

    const order = (await res.json()) as any;

    if (!res.ok) {
      console.error('Conekta error:', order);
      const msg = order?.details?.[0]?.message || order?.message || 'Error al crear orden de pago';
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: msg }) };
    }

    const charge = order.charges?.data?.[0];
    const pm = charge?.payment_method;

    return {
      statusCode: 200,
      headers: CORS,
      body: JSON.stringify({
        order_id: order.id,
        reference: pm?.reference ?? '',
        barcode_url: pm?.barcode_url ?? '',
        expires_at: pm?.expires_at ?? expiresAt,
        amount: 299,
      }),
    };
  } catch (err: any) {
    console.error('create-payment error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Error interno del servidor' }) };
  }
};
