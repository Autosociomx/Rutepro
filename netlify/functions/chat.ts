import { GoogleGenAI } from '@google/genai';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function offlineFallback(question: string, ventas: any[], clientesLedger: any[]): string {
  const q = (question || '').toLowerCase();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  if (q.includes('hora') || q.includes('tiempo') || q.includes('reloj')) {
    return `La hora local en el Centro de Distribución es ${timeStr}.`;
  }
  if (q.includes('fecha') || q.includes('día') || q.includes('dia') || q.includes('calendario')) {
    return `La fecha operativa es ${dateStr}. Útil para calendarizar despachos y turnos de choferes.`;
  }
  if (q.includes('deuda') || q.includes('saldo') || q.includes('pendiente') || q.includes('debe') || q.includes('abono')) {
    const unpaid = (clientesLedger || []).filter((c: any) => c.saldo_actual > 0);
    const total = unpaid.reduce((s: number, c: any) => s + (c.saldo_actual || 0), 0);
    if (unpaid.length === 0) return 'Sin cuentas pendientes registradas por el momento. ¡Excelente cartera limpia!';
    const lista = unpaid.slice(0, 3).map((u: any) => `${u.nombre} ($${(u.saldo_actual / 100).toFixed(2)})`).join(', ');
    return `Cuentas por cobrar: ${unpaid.length} clientes, total $${(total / 100).toFixed(2)}. Principales deudores: ${lista}.`;
  }
  if (q.includes('venta') || q.includes('cobr') || q.includes('total') || q.includes('resumen')) {
    const tot = (ventas || []).reduce((s: number, v: any) => s + (v.monto || 0), 0);
    const efectivo = (ventas || []).filter((v: any) => v.tipoCobro === 'efectivo').reduce((s: number, v: any) => s + (v.monto || 0), 0);
    const credito = tot - efectivo;
    return `Hoy: ${(ventas || []).length} transacciones · Efectivo $${(efectivo / 100).toFixed(2)} · Crédito $${(credito / 100).toFixed(2)} · Total $${(tot / 100).toFixed(2)}.`;
  }
  if (q.includes('ruta') || q.includes('vendedor') || q.includes('mejor')) {
    const byVendedor: { [k: string]: number } = {};
    (ventas || []).forEach((v: any) => {
      const n = v.vendedorNombre || 'Sin nombre';
      byVendedor[n] = (byVendedor[n] || 0) + (v.monto || 0);
    });
    const sorted = Object.entries(byVendedor).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return 'Sin ventas registradas en ruta todavía hoy.';
    return `Mejor ruta hoy: ${sorted[0][0]} con $${(sorted[0][1] / 100).toFixed(2)} cobrado. Consulta el panel de rutas para el mapa completo.`;
  }
  return `Tengo cargados los balances y ventas del día. Pregúntame por deudores, la ruta con más ventas, el total cobrado o el resumen para WhatsApp.`;
}

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { question, config_negocio, ventas, vendedores, chatHistory, abonos, clientesLedger } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ text: offlineFallback(question, ventas, clientesLedger) })
      };
    }

    const ai = new GoogleGenAI({ apiKey });

    const businessName = config_negocio?.nombre || 'Mi Negocio';
    const localTimeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const localDateStr = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const salesOverview = (ventas || []).slice(0, 30).map((v: any) => ({
      vendedor: v.vendedorNombre || v.vendedor_nombre,
      cliente: v.clienteNombre || v.cliente_nombre,
      monto: `$${((v.monto || 0) / 100).toFixed(2)}`,
      tipoCobro: v.tipoCobro || v.tipo_cobro,
      hora: v.hora,
    }));

    const ledgerOverview = (clientesLedger || []).slice(0, 20).map((c: any) => ({
      nombre: c.nombre,
      saldo: `$${((c.saldo_actual || 0) / 100).toFixed(2)}`,
      credito: `$${((c.total_compras || 0) / 100).toFixed(2)}`,
      abonado: `$${((c.total_abonos || 0) / 100).toFixed(2)}`,
    }));

    const abonosOverview = (abonos || []).slice(0, 10).map((ab: any) => ({
      cliente: ab.clienteNombre,
      monto: `$${((ab.monto || 0) / 100).toFixed(2)}`,
      fecha: ab.fecha,
    }));

    const prompt = `Eres el Asesor Financiero Digital de RoutePro Elite para el negocio "${businessName}".
Hora actual en sucursal: ${localTimeStr} · Fecha: ${localDateStr}

VENTAS DEL TURNO: ${JSON.stringify(salesOverview)}
CUENTAS POR COBRAR (ledger): ${JSON.stringify(ledgerOverview)}
ABONOS REGISTRADOS: ${JSON.stringify(abonosOverview)}
CHAT PREVIO: ${JSON.stringify((chatHistory || []).slice(-4))}

PREGUNTA DEL DUEÑO: "${question}"

INSTRUCCIONES:
- Responde en máximo 4 líneas en español mexicano profesional y amigable.
- Cita montos exactos en pesos si preguntan por saldos. NUNCA inventes deudas.
- Si preguntan por el mejor vendedor/ruta, compara los montos de ventas y di el nombre.
- Para resumen de WhatsApp, da un texto copiable con los totales del día.
- Si no hay datos suficientes para responder, dilo con honestidad.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: { temperature: 0.6 }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text: response.text || 'Sin respuesta del asistente.' })
    };
  } catch (error: any) {
    console.error('Chat function error:', error?.message || error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ text: 'Error al procesar la consulta. Verifica tu conexión e intenta de nuevo.' })
    };
  }
};
