const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const handler = async (event: any) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // Reject non-POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }),
    };
  }

  // Check API key
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: 'RESEND_API_KEY no configurado en Netlify' }),
    };
  }

  // Parse body
  let body: {
    to: string;
    negocio: string;
    fecha: string;
    totalVentas: number | string;
    efectivo: number | string;
    credito: number | string;
    mermas: number | string;
    topVendedor: string;
    cuentasPorCobrar: number | string;
    totalDeuda: number | string;
  };

  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ ok: false, error: 'Invalid JSON body' }),
    };
  }

  const {
    to,
    negocio,
    fecha,
    totalVentas,
    efectivo,
    credito,
    mermas,
    topVendedor,
    cuentasPorCobrar,
    totalDeuda,
  } = body;

  const from = process.env.RESEND_FROM || 'onboarding@resend.dev';

  const fmt = (val: number | string) =>
    typeof val === 'number'
      ? val.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })
      : val;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Resumen del día — ${negocio}</title>
</head>
<body style="margin:0;padding:0;background-color:#06080C;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#06080C;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background-color:#0E1117;border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;border-bottom:3px solid #D97706;">
              <p style="margin:0 0 4px 0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#D97706;font-weight:600;">RoutePro Elite</p>
              <h1 style="margin:0 0 8px 0;font-size:26px;font-weight:700;color:#FFFFFF;">📊 Resumen del Día</h1>
              <p style="margin:0;font-size:20px;font-weight:600;color:#D97706;">${negocio}</p>
              <p style="margin:8px 0 0 0;font-size:14px;color:#9CA3AF;">${fecha}</p>
            </td>
          </tr>

          <!-- Sales cards -->
          <tr>
            <td style="background-color:#0E1117;padding:28px 40px 8px 40px;">
              <p style="margin:0 0 16px 0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280;font-weight:600;">Ventas del día</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Total Ventas -->
                  <td width="48%" style="background-color:#141820;border-radius:10px;padding:20px;border:1px solid #1F2937;vertical-align:top;">
                    <p style="margin:0 0 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;">Total Ventas</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#D97706;">${fmt(totalVentas)}</p>
                  </td>
                  <td width="4%">&nbsp;</td>
                  <!-- Efectivo -->
                  <td width="48%" style="background-color:#141820;border-radius:10px;padding:20px;border:1px solid #1F2937;vertical-align:top;">
                    <p style="margin:0 0 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;">Efectivo</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#10B981;">${fmt(efectivo)}</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
                <tr>
                  <!-- A Crédito -->
                  <td width="48%" style="background-color:#141820;border-radius:10px;padding:20px;border:1px solid #1F2937;vertical-align:top;">
                    <p style="margin:0 0 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;">A Crédito</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#60A5FA;">${fmt(credito)}</p>
                  </td>
                  <td width="4%">&nbsp;</td>
                  <!-- Mermas -->
                  <td width="48%" style="background-color:#141820;border-radius:10px;padding:20px;border:1px solid #1F2937;vertical-align:top;">
                    <p style="margin:0 0 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;">Mermas</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#F87171;">${fmt(mermas)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Top Vendedor -->
          <tr>
            <td style="background-color:#0E1117;padding:20px 40px 8px 40px;">
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280;font-weight:600;">Top vendedor del día</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#141820;border-radius:10px;padding:20px;border:1px solid #D97706;">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="font-size:28px;padding-right:14px;vertical-align:middle;">🏆</td>
                        <td style="vertical-align:middle;">
                          <p style="margin:0 0 2px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;">Mejor vendedor</p>
                          <p style="margin:0;font-size:18px;font-weight:700;color:#FFFFFF;">${topVendedor}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuentas por cobrar -->
          <tr>
            <td style="background-color:#0E1117;padding:20px 40px 28px 40px;">
              <p style="margin:0 0 12px 0;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#6B7280;font-weight:600;">Cuentas por cobrar</p>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <!-- Total Deuda -->
                  <td width="48%" style="background-color:#141820;border-radius:10px;padding:20px;border:1px solid #1F2937;vertical-align:top;">
                    <p style="margin:0 0 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;">Total Deuda</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#F59E0B;">${fmt(totalDeuda)}</p>
                  </td>
                  <td width="4%">&nbsp;</td>
                  <!-- Clientes -->
                  <td width="48%" style="background-color:#141820;border-radius:10px;padding:20px;border:1px solid #1F2937;vertical-align:top;">
                    <p style="margin:0 0 6px 0;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;">Clientes con saldo</p>
                    <p style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF;">${cuentasPorCobrar}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#080A0F;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border-top:1px solid #1F2937;">
              <p style="margin:0;font-size:12px;color:#6B7280;">
                <span style="color:#D97706;font-weight:600;">RoutePro Elite</span> · Reporte automático
              </p>
              <p style="margin:6px 0 0 0;font-size:11px;color:#374151;">Este mensaje fue generado automáticamente. No responder a este correo.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `📊 Resumen del día — ${negocio} · ${fecha}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        statusCode: res.status,
        headers,
        body: JSON.stringify({ ok: false, error: errText }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err: any) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err?.message || 'Unknown error' }),
    };
  }
};
