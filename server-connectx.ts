import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { createConnectXCommandRouter } from './server/connectxCommandRouter';

dotenv.config();

let client: GoogleGenAI | null = null;
const getAI = (): GoogleGenAI | null => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
};

const normalizeColor = (value?: string): string => /^#[0-9a-f]{6}$/i.test(value || '') ? value! : '#E5B84B';

function deterministicConfig(description: string) {
  const lower = description.toLowerCase();
  const restaurant = /restaurante|antojito|marisco|cafe|cafeter/.test(lower);
  const bakery = /panader|pan |bolillo|pastel/.test(lower);
  const tortilla = /tortiller|tortilla|masa/.test(lower);
  const vertical = restaurant ? 'restaurant' : bakery ? 'bakery' : tortilla ? 'tortilleria' : 'distribution';
  const routes = restaurant ? [] : [{ id: 'route-1', nombre: 'Ruta 1', ruta: 'Ruta 1' }];
  const products = restaurant
    ? [
        { id: 'p1', nombre: 'Producto principal', precio: 85, unidad: 'pza' },
        { id: 'p2', nombre: 'Bebida', precio: 25, unidad: 'pza' },
      ]
    : [
        { id: 'p1', nombre: bakery ? 'Pan surtido' : tortilla ? 'Tortilla' : 'Producto 1', precio: bakery ? 10 : tortilla ? 26 : 50, unidad: bakery ? 'pza' : tortilla ? 'kg' : 'pza' },
        { id: 'p2', nombre: bakery ? 'Pan dulce' : tortilla ? 'Tostadas' : 'Producto 2', precio: bakery ? 12 : tortilla ? 35 : 70, unidad: 'pza' },
      ];
  return {
    nombre: description.split(/[.,\n]/)[0]?.trim().slice(0, 60) || 'Mi Negocio',
    subtitulo: restaurant ? 'Operación de local y venta directa' : 'Venta y distribución en ruta',
    color_principal: '#E5B84B',
    vertical,
    productos: products,
    vendedores: routes,
    source: 'deterministic',
  };
}

async function generateConfig(description: string) {
  const fallback = deterministicConfig(description);
  const ai = getAI();
  if (!ai) return fallback;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: `Convierte esta descripción de una PyME en una configuración inicial de software operativo. No inventes precios absurdos. Descripción: ${description}`,
      config: {
        systemInstruction: 'Eres el configurador de ConnectX Negocio OS. Responde únicamente JSON válido y conservador.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nombre: { type: Type.STRING },
            subtitulo: { type: Type.STRING },
            color_principal: { type: Type.STRING },
            vertical: { type: Type.STRING },
            productos: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  nombre: { type: Type.STRING },
                  precio: { type: Type.NUMBER },
                  unidad: { type: Type.STRING },
                },
                required: ['id','nombre','precio','unidad'],
              },
            },
            vendedores: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  nombre: { type: Type.STRING },
                  ruta: { type: Type.STRING },
                },
                required: ['id','nombre','ruta'],
              },
            },
          },
          required: ['nombre','subtitulo','color_principal','vertical','productos','vendedores'],
        },
      },
    });
    const parsed = JSON.parse(response.text || '{}');
    return { ...fallback, ...parsed, color_principal: normalizeColor(parsed.color_principal), source: 'ai' };
  } catch {
    return fallback;
  }
}

async function start() {
  const app = express();
  const port = Number(process.env.CONNECTX_PORT || 3100);
  app.use(express.json({ limit: '256kb' }));
  app.use('/api/connectx', createConnectXCommandRouter());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', product: 'ConnectX Negocio OS', ai: Boolean(getAI()), timestamp: Date.now() }));

  app.post('/api/generate-config', async (req, res) => {
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    if (!description) return res.status(400).json({ error: 'description requerida' });
    return res.json(await generateConfig(description.slice(0, 5000)));
  });

  app.post('/api/predict', async (req, res) => {
    const products = Array.isArray(req.body?.productos) ? req.body.productos : [];
    const weekend = ['Sábado','Domingo'].includes(req.body?.diaSemana);
    const factor = weekend ? 1.18 : 1.08;
    return res.json({
      recomendaciones: products.map((product: any) => ({ productId: String(product.id), cantidad: Math.max(0, Math.ceil(Number(product.defaultCarga || 30) * factor)) })),
      explicacion: getAI()
        ? 'Modo híbrido activo. Esta respuesta usa una regla segura; el proveedor de IA puede enriquecer recomendaciones en versiones posteriores.'
        : 'Modo determinista activo. Recomendación calculada sin proveedor de IA externo.',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const dist = path.resolve(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`ConnectX Negocio OS running on http://0.0.0.0:${port}`);
  });
}

start().catch(error => {
  console.error('ConnectX server failed', error);
  process.exitCode = 1;
});
