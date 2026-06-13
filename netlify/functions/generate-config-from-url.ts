import { GoogleGenAI, Type } from '@google/genai';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function smartFallback(url: string, snippet: string) {
  let domain = 'Negocio';
  try {
    const clean = url.replace(/^(https?:\/\/)?(www\.)?/, '');
    const part = clean.split('/')[0].split('.')[0];
    if (part) domain = part.charAt(0).toUpperCase() + part.slice(1);
  } catch (_) {}

  let nombre = domain;
  if (snippet) {
    const m = snippet.match(/Título:\s*"([^"]+)"/);
    if (m?.[1]) {
      const t = m[1].split(/[|•\-\n]/)[0].trim();
      if (t && t.length > 2 && t.length < 35) nombre = t;
    }
  }

  const s = (url + ' ' + snippet + ' ' + nombre).toLowerCase();

  if (s.includes('nayarit') || s.includes('tostada') || s.includes('tortilla') || s.includes('salsa') || s.includes('marisco') || s.includes('queso') || s.includes('antojo')) {
    return { nombre: nombre === 'Negocio' ? 'Tostadas Nayaritas' : nombre, letra: nombre.substring(0, 2).toUpperCase(), subtitulo: 'El auténtico sabor de Nayarit en tu mesa', color_principal: '#D97706',
      productos: [
        { id: 'F1', icono: '🫓', nombre: 'Tostadas Raspadas (Paquete Familiar)', precio: 3800, unidad: 'pac' },
        { id: 'F2', icono: '🌮', nombre: 'Tortilla de Maíz Nixtamalizado (1 Kg)', precio: 2400, unidad: 'kg' },
        { id: 'F3', icono: '🌶️', nombre: 'Salsa Picante Huichol Tradicional', precio: 1900, unidad: 'pza' },
        { id: 'F4', icono: '🧀', nombre: 'Queso Cotija Seco Madurado', precio: 9500, unidad: 'kg' },
      ],
      vendedores: [
        { id: 'V1', nombre: 'Juan Pablo Díaz', rol: 'repartidor', ruta: 'Ruta Costa y Huajicori' },
        { id: 'V2', nombre: 'Alondra Bañales', rol: 'cajero', ruta: 'Mostrador Tepic Centro' }
      ]
    };
  }
  if (s.includes('agua') || s.includes('purif') || s.includes('oasis') || s.includes('hielo') || s.includes('vital')) {
    return { nombre: nombre === 'Negocio' ? 'Purificadora Cristal' : nombre, letra: 'H2O', subtitulo: 'Agua pura y reparto confiable a domicilio', color_principal: '#0284C7',
      productos: [
        { id: 'F1', icono: '💧', nombre: 'Garrafón 20L Agua Purificada', precio: 4500, unidad: 'garrafón' },
        { id: 'F2', icono: '🔄', nombre: 'Relleno de Garrafón', precio: 1800, unidad: 'pza' },
        { id: 'F3', icono: '🧊', nombre: 'Bolsa de Hielo en Cubo 5 Kg', precio: 3200, unidad: 'caja' },
        { id: 'F4', icono: '🫙', nombre: 'Botellón 10L', precio: 2000, unidad: 'botellón' },
      ],
      vendedores: [
        { id: 'V1', nombre: 'Andrés López', rol: 'repartidor', ruta: 'Ruta Residenciales' },
        { id: 'V2', nombre: 'Estela Martínez', rol: 'cajero', ruta: 'Despacho Avenida' }
      ]
    };
  }
  if (s.includes('pan') || s.includes('panaderia') || s.includes('cafe') || s.includes('postre') || s.includes('pastel') || s.includes('bakery')) {
    return { nombre: nombre === 'Negocio' ? 'Panadería La Concha de Oro' : nombre, letra: nombre.substring(0, 1).toUpperCase(), subtitulo: 'Pan artesanal horneado fresco cada día', color_principal: '#B45309',
      productos: [
        { id: 'F1', icono: '🥐', nombre: 'Conchas Surtidas (6 Pzs)', precio: 4500, unidad: 'pac' },
        { id: 'F2', icono: '🥖', nombre: 'Bolillo Rústico (10 Pzs)', precio: 3000, unidad: 'pac' },
        { id: 'F3', icono: '🧁', nombre: 'Pan Dulce Surtido (caja)', precio: 8500, unidad: 'caja' },
        { id: 'F4', icono: '🍰', nombre: 'Pastel de Tres Leches', precio: 24000, unidad: 'pza' },
      ],
      vendedores: [
        { id: 'V1', nombre: 'Fernando Ruiz', rol: 'repartidor', ruta: 'Ruta Cafeterías del Valle' },
        { id: 'V2', nombre: 'Lucía Benítez', rol: 'cajero', ruta: 'Matriz Despacho' }
      ]
    };
  }
  if (s.includes('carne') || s.includes('carnicer') || s.includes('pollo') || s.includes('res') || s.includes('bistec')) {
    return { nombre: nombre === 'Negocio' ? 'Carnicería El Rancho' : nombre, letra: nombre.substring(0, 1).toUpperCase(), subtitulo: 'Cortes frescos y embutidos artesanales', color_principal: '#C0392B',
      productos: [
        { id: 'F1', icono: '🥩', nombre: 'Bistec de Res kg', precio: 18000, unidad: 'kg' },
        { id: 'F2', icono: '🍗', nombre: 'Pollo Entero kg', precio: 9000, unidad: 'kg' },
        { id: 'F3', icono: '🌭', nombre: 'Chorizo Artesanal kg', precio: 16000, unidad: 'kg' },
        { id: 'F4', icono: '🥓', nombre: 'Costilla de Res kg', precio: 17000, unidad: 'kg' },
      ],
      vendedores: [
        { id: 'V1', nombre: 'Ernesto Vargas', rol: 'repartidor', ruta: 'Ruta Mercados' },
        { id: 'V2', nombre: 'Diana Salinas', rol: 'cajero', ruta: 'Mostrador Local' }
      ]
    };
  }
  return { nombre: nombre === 'Negocio' ? 'Distribuidora Express' : nombre, letra: nombre.substring(0, 2).toUpperCase(), subtitulo: 'Distribución inteligente en tu zona', color_principal: '#10B981',
    productos: [
      { id: 'F1', icono: '📦', nombre: 'Paquete Comercial Estándar', precio: 15000, unidad: 'caja' },
      { id: 'F2', icono: '✨', nombre: 'Producto Premium de la Casa', precio: 4800, unidad: 'pza' },
      { id: 'F3', icono: '🛒', nombre: 'Surtido Mixto Semanal', precio: 29900, unidad: 'caja' },
      { id: 'F4', icono: '🚚', nombre: 'Servicio de Entrega Express', precio: 8500, unidad: 'pza' },
    ],
    vendedores: [
      { id: 'V1', nombre: 'Santiago Morales', rol: 'repartidor', ruta: 'Ruta Metropolitana Este' },
      { id: 'V2', nombre: 'Diana Cabrera', rol: 'cajero', ruta: 'Mostrador Central' }
    ]
  };
}

export const handler = async (event: any) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }

  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta la URL del negocio' }) };
    }

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'https://' + targetUrl;

    let pageSnippet = '';
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 3000);
      const res = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RoutePro-Bot/1.0)' },
        signal: ctrl.signal
      });
      clearTimeout(tid);
      if (res.ok) {
        const html = await res.text();
        const title = html.match(/<title>([^<]+)<\/title>/i)?.[1] || '';
        const meta = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] || '';
        const body = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1200);
        pageSnippet = `Título: "${title}". Meta: "${meta}". Contenido: ${body}`;
      }
    } catch (_) {}

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return { statusCode: 200, headers, body: JSON.stringify(smartFallback(targetUrl, pageSnippet)) };
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Analiza este negocio para configurar una demostración de RoutePro:
URL: "${targetUrl}"
Contenido descubierto: "${pageSnippet}"

Investiga usando Google Search para encontrar: nombre real, productos estrella con precios reales en centavos (ej: $35 MXN = 3500 centavos), color de marca y slogan.
Genera una configuración JSON detallada y realista en español de México.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nombre: { type: Type.STRING },
              letra: { type: Type.STRING },
              subtitulo: { type: Type.STRING },
              color_principal: { type: Type.STRING },
              productos: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    icono: { type: Type.STRING },
                    nombre: { type: Type.STRING },
                    precio: { type: Type.INTEGER },
                    unidad: { type: Type.STRING }
                  },
                  required: ['id', 'icono', 'nombre', 'precio', 'unidad']
                }
              },
              vendedores: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    nombre: { type: Type.STRING },
                    rol: { type: Type.STRING },
                    ruta: { type: Type.STRING }
                  },
                  required: ['id', 'nombre', 'rol', 'ruta']
                }
              }
            },
            required: ['nombre', 'letra', 'subtitulo', 'color_principal', 'productos', 'vendedores']
          }
        }
      });

      const result = JSON.parse((response.text || '{}').trim());
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    } catch (_) {
      return { statusCode: 200, headers, body: JSON.stringify(smartFallback(targetUrl, pageSnippet)) };
    }
  } catch (error: any) {
    console.error('generate-config-from-url error:', error?.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error procesando el sitio web' }) };
  }
};
