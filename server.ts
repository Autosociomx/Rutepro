/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getGemini(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to test backend status
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // API for predictive route loading supporting ANY custom products list using Gemini 3.5 Flash
  app.post('/api/predict', async (req, res) => {
    try {
      const { vendedorNombre, diaSemana, productos, recentActivity } = req.body;

      let ai;
      try {
        ai = getGemini();
      } catch (keyErr) {
        // Fallback gracefully to high-quality heuristics if GEMINI_API_KEY is not defined yet
        const factor = diaSemana === 'Sábado' || diaSemana === 'Domingo' ? 1.25 : 1.0;
        const recomendaciones = (productos || []).map((p: any) => ({
          productId: p.id,
          cantidad: Math.round((p.defaultCarga || 30) * factor)
        }));
        return res.json({
          recomendaciones,
          explicacion: `Sugerencia heurística offline para ${diaSemana}: Se incrementó un 25% el stock promedio estimado por fin de semana.`
        });
      }

      const promptString = `Estima la carga de ruta inteligente para hoy para el vendedor: "${vendedorNombre}".
Hoy es día: ${diaSemana}.
Los productos configurados en el catálogo corporativo son:
${JSON.stringify(productos || [])}

Actividad reciente en el panel:
${recentActivity || "Servicios ordinarios en las últimas jornadas de reparto."}

Sugerir un inventario ideal de salida para cada producto en el catálogo. Retorna un ajuste inteligente basado en el giro de negocio y el día de la semana.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptString,
        config: {
          systemInstruction: 'Eres "RoutePro Elite AI", una inteligencia artificial que ayuda a dueños de negocios móviles de distribución, reparto o venta a optimizar la salida de inventario de sus vehículos. Minimiza pérdidas, calcula mermas y asegura abasto según el día de la semana.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recomendaciones: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    productId: { type: Type.STRING },
                    cantidad: { type: Type.INTEGER, description: 'Cantidad óptima estimada' }
                  },
                  required: ['productId', 'cantidad']
                }
              },
              explicacion: { 
                type: Type.STRING, 
                description: 'Breve explicación de 1 o 2 renglones en español mexicano sobre la lógica del ajuste de carga hoy.' 
              }
            },
            required: ['recomendaciones', 'explicacion']
          }
        }
      });

      const responseText = response.text || '';
      const result = JSON.parse(responseText.trim());
      res.json(result);
    } catch (error) {
      console.error('Gemini prediction error:', error);
      // Fallback response for stability
      const fallbackRecs = (req.body.productos || []).map((p: any) => ({
        productId: p.id,
        cantidad: 30
      }));
      res.json({
        recomendaciones: fallbackRecs,
        explicacion: 'Inventario habitual recomendado de seguridad (contingencia por intermitencia de red o API).'
      });
    }
  });

  // API for AI generation of complete business configuration supporting ANY custom business niche
  app.post('/api/generate-config', async (req, res) => {
    try {
      const { description } = req.body;
      if (!description) {
        return res.status(400).json({ error: 'Falta la descripción del negocio' });
      }

      let ai;
      try {
        ai = getGemini();
      } catch (err) {
        // Fallback offline generator if no API key is set
        const desc = (description || '').toLowerCase();
        let name = 'Distribuidora Express';
        let sub = 'Servicios a domicilio profesionales';
        let letra = 'D';
        let col = '#00C896';
        let prods = [
          { id: 'P_F1', icono: '📦', nombre: 'Caja estándar general', precio: 5000, unidad: 'caja' },
          { id: 'P_F2', icono: '🚚', nombre: 'Paquete de entrega', precio: 1500, unidad: 'pza' },
          { id: 'P_F3', icono: '🏷️', nombre: 'Surtido premium', precio: 12000, unidad: 'pac' }
        ];
        if (desc.includes('pan') || desc.includes('bakery')) {
          name = 'Pastelería El Trigo Dorado';
          letra = 'T';
          sub = 'Pan caliente a domicilio';
          col = '#C9822A';
          prods = [
            { id: 'P_F1', icono: '🍞', nombre: 'Pan Bolillo', precio: 200, unidad: 'pza' },
            { id: 'P_F2', icono: '🥖', nombre: 'Teleras bolsa', precio: 600, unidad: 'pac' },
            { id: 'P_F3', icono: '🧁', nombre: 'Pan dulce surtido', precio: 1500, unidad: 'caja' }
          ];
        } else if (desc.includes('agua') || desc.includes('pure')) {
          name = 'Purificadora Manantial H2O';
          letra = 'M';
          sub = 'Agua fresca y purificada';
          col = '#4A8FFF';
          prods = [
            { id: 'P_F1', icono: '💧', nombre: 'Garrafón 20L', precio: 3500, unidad: 'garrafón' },
            { id: 'P_F2', icono: '🫙', nombre: 'Botellón 10L', precio: 2000, unidad: 'botellón' },
            { id: 'P_F3', icono: '🔄', nombre: 'Intercambio rápido', precio: 3000, unidad: 'pza' }
          ];
        }
        return res.json({
          nombre: name,
          letra,
          subtitulo: sub,
          color_principal: col,
          productos: prods,
          vendedores: [
            { id: 'V_F1', nombre: 'Carlos Mendoza', rol: 'repartidor', ruta: 'Ruta Oriente' },
            { id: 'V_F2', nombre: 'Gaby Solis', rol: 'cajero', ruta: 'Mostrador Central' }
          ]
        });
      }

      const promptString = `Genera una configuración completa de negocio para "RoutePro" basada en la siguiente descripción dada por el usuario:
"${description}"

Establece un nombre de marca elegante en español mexicano, un subtítulo descriptivo, una letra de logotipo (1 o 2 letras), un color hexadecimal primario hermoso que combine, una lista de 4 a 6 productos estrella realistas con precios detallados en centavos (ej: $18.50 pesos es 1850 cents, $100.00 pesos es 10000 cents) y unidades correctas, y una lista de 2 a 3 trabajadores mexicanos en sus respectivas rutas.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptString,
        config: {
          systemInstruction: 'Eres "RoutePro Setup Engine", un formateador estructurado que genera configuraciones de negocio instantáneas, profesionales y realistas para dueños de empresas de distribución, mostrador o ventas móviles.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nombre: { type: Type.STRING, description: 'Brand name' },
              letra: { type: Type.STRING, description: '1-2 caps abbreviation for Logo stamp' },
              subtitulo: { type: Type.STRING, description: 'Catchy professional description' },
              color_principal: { type: Type.STRING, description: 'Theme hex color code' },
              productos: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    icono: { type: Type.STRING, description: 'Single emoji representing product' },
                    nombre: { type: Type.STRING, description: 'Item name' },
                    precio: { type: Type.INTEGER, description: 'Standard wholesale price in cents MXN (e.g., $18.50 MXN = 1850)' },
                    unidad: { type: Type.STRING, description: 'Unit descriptor: pza, kg, lt, garrafón, botellón, caja, pac' }
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
                    nombre: { type: Type.STRING, description: 'Employee name' },
                    rol: { type: Type.STRING, description: 'Must be "repartidor", "cajero" or "ambos"' },
                    ruta: { type: Type.STRING, description: 'Sub-territory / Zone name' }
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
      res.json(result);
    } catch (error) {
      console.error('Error generating AI config:', error);
      res.status(500).json({ error: 'Error procesando la solicitud con IA' });
    }
  });

  // Smart heuristic business generator as a robust local fallback when Gemini is busy or rate-limited
  function getSmartFallbackFromUrl(url: string, pageSnippet: string) {
    let domain = 'Negocio';
    try {
      const cleanUrl = url.replace(/^(https?:\/\/)?(www\.)?/, '');
      const firstPart = cleanUrl.split('/')[0];
      const namePart = firstPart.split('.')[0];
      if (namePart) {
        domain = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      }
    } catch (e) {}

    // Clean up title metadata if any
    let titleExcerpt = '';
    if (pageSnippet) {
      const titleMatch = pageSnippet.match(/Título de la página:\s*"([^"]+)"/);
      if (titleMatch && titleMatch[1]) {
        titleExcerpt = titleMatch[1].trim();
      }
    }

    // Determine the most representative name
    let nombre = domain;
    if (titleExcerpt && titleExcerpt.length > 3) {
      const cleanedTitle = titleExcerpt.split(/[|•\-\n]/)[0].trim();
      if (cleanedTitle && cleanedTitle.length < 35 && cleanedTitle.length > 2) {
        nombre = cleanedTitle;
      }
    }

    const normalizedLower = (url + ' ' + pageSnippet + ' ' + nombre).toLowerCase();

    // 1. Category: Mexican Artisanal Foods & Tortillerias (like Nayaritas.mx)
    if (
      normalizedLower.includes('nayarit') ||
      normalizedLower.includes('tostada') ||
      normalizedLower.includes('tortilla') ||
      normalizedLower.includes('salsa') ||
      normalizedLower.includes('huichol') ||
      normalizedLower.includes('marisco') ||
      normalizedLower.includes('comida') ||
      normalizedLower.includes('antojo') ||
      normalizedLower.includes('queso') ||
      normalizedLower.includes('sabor')
    ) {
      return {
        nombre: nombre === 'Negocio' ? 'Nayaritas Tradicional' : nombre,
        letra: nombre.substring(0, 2).toUpperCase() || 'NY',
        subtitulo: 'Tortillas, tostadas y el auténtico sabor de Nayarit',
        color_principal: '#D97706',
        productos: [
          { id: 'PH_F1', icono: '🫓', nombre: 'Tostadas Raspadas (Paquete Familiar)', precio: 3800, unidad: 'pac' },
          { id: 'PH_F2', icono: '🌮', nombre: 'Tortilla de Maíz Nixtamalizado (1 Kg)', precio: 2400, unidad: 'kg' },
          { id: 'PH_F3', icono: '🌶️', nombre: 'Salsa Picante Huichol Tradicional', precio: 1900, unidad: 'pza' },
          { id: 'PH_F4', icono: '🧀', nombre: 'Queso Cotija Seco Madurado', precio: 9500, unidad: 'kg' },
          { id: 'PH_F5', icono: '📦', nombre: 'Tostadas Deshidratadas Súper Crujientes', precio: 3500, unidad: 'pac' }
        ],
        vendedores: [
          { id: 'VH_F1', nombre: 'Juan Pablo Díaz', rol: 'repartidor', ruta: 'Ruta Costa y Huajicori' },
          { id: 'VH_F2', nombre: 'Alondra Bañales', rol: 'cajero', ruta: 'Mostrador Tepic Centro' }
        ]
      };
    }

    // 2. Category: Purified Water Depots / Oasis
    if (
      normalizedLower.includes('agua') ||
      normalizedLower.includes('purif') ||
      normalizedLower.includes('oasis') ||
      normalizedLower.includes('hielo') ||
      normalizedLower.includes('aqua') ||
      normalizedLower.includes('vital')
    ) {
      return {
        nombre: nombre === 'Negocio' ? 'Agua Purificada Oasis' : nombre,
        letra: 'H2O',
        subtitulo: 'Hidratación pura y reparto confiable a domicilio',
        color_principal: '#0284C7',
        productos: [
          { id: 'PH_W1', icono: '💧', nombre: 'Garrafón 20L Agua Purificada', precio: 4500, unidad: 'garrafón' },
          { id: 'PH_W2', icono: '🔄', nombre: 'Relleno de Garrafón (Sucursal)', precio: 1800, unidad: 'pza' },
          { id: 'PH_W3', icono: '🧊', nombre: 'Bolsa de Hielo en Cubo (5 Kg)', precio: 3200, unidad: 'caja' },
          { id: 'PH_W4', icono: '🥤', nombre: 'Paquete de Vasos Cono Desechables', precio: 4000, unidad: 'pac' }
        ],
        vendedores: [
          { id: 'VH_W1', nombre: 'Andrés López', rol: 'repartidor', ruta: 'Ruta Residenciales' },
          { id: 'VH_W2', nombre: 'Estela Martínez', rol: 'cajero', ruta: 'Despacho Avenida' }
        ]
      };
    }

    // 3. Category: Bakeries, Coffee Shops and Dessert Cafes
    if (
      normalizedLower.includes('cafe') ||
      normalizedLower.includes('coffee') ||
      normalizedLower.includes('pan') ||
      normalizedLower.includes('bakery') ||
      normalizedLower.includes('panaderia') ||
      normalizedLower.includes('postre') ||
      normalizedLower.includes('pastel')
    ) {
      return {
        nombre: nombre === 'Negocio' ? 'Panadería La Concha de Oro' : nombre,
        letra: nombre.substring(0, 1).toUpperCase() || 'P',
        subtitulo: 'Aroma fresco y repostería artesanal horneada hoy',
        color_principal: '#B45309',
        productos: [
          { id: 'PH_B1', icono: '🥐', nombre: 'Conchas Surtidas Recién Horneadas (6 Pzs)', precio: 4500, unidad: 'pac' },
          { id: 'PH_B2', icono: '🥖', nombre: 'Bolillo Rústico Calientito (10 Pzs)', precio: 3000, unidad: 'pac' },
          { id: 'PH_B3', icono: '☕', nombre: 'Café de Olla Molido Orgánico (1 Kg)', precio: 19500, unidad: 'kg' },
          { id: 'PH_B4', icono: '🍰', nombre: 'Pastel de Tres Leches Tradicional', precio: 24000, unidad: 'pza' }
        ],
        vendedores: [
          { id: 'VH_B1', nombre: 'Fernando Ruiz', rol: 'repartidor', ruta: 'Ruta Cafeterías del Valle' },
          { id: 'VH_B2', nombre: 'Lucía Benítez', rol: 'cajero', ruta: 'Matriz Despacho' }
        ]
      };
    }

    // 4. Default: Elegant multipurpose retail or local store distribution
    return {
      nombre: nombre === 'Negocio' ? 'Distribuidora Express' : nombre,
      letra: nombre.substring(0, 2).toUpperCase() || 'D',
      subtitulo: 'Catálogo premium y entrega inteligente en tu zona',
      color_principal: '#10B981',
      productos: [
        { id: 'PH_G1', icono: '📦', nombre: 'Paquete Comercial Solución Completa', precio: 15000, unidad: 'caja' },
        { id: 'PH_G2', icono: '✨', nombre: 'Accesorio Especial Durabilidad Máxima', precio: 4800, unidad: 'pza' },
        { id: 'PH_G3', icono: '🛡️', nombre: 'Suscripción de Soporte y Repuestos', precio: 8500, unidad: 'pza' },
        { id: 'PH_G4', icono: '🏷️', nombre: 'Lote de Consumibles Básicos de la Casa', precio: 29900, unidad: 'caja' }
      ],
      vendedores: [
        { id: 'VH_G1', nombre: 'Santiago Morales', rol: 'repartidor', ruta: 'Ruta Metropolitana Este' },
        { id: 'VH_G2', nombre: 'Diana Cabrera', rol: 'cajero', ruta: 'Mostrador Central' }
      ]
    };
  }

  // API to scrape and generate a full custom business configuration from a website URL using Gemini Grounded Web Search
  app.post('/api/generate-config-from-url', async (req, res) => {
    let { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Falta la dirección URL del negocio' });
    }

    // Format URL
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    console.log('Generando demo inteligente a partir del sitio web:', targetUrl);

    // Attempt to fetch homepage HTML metadata with timeout for resilience
    let pageSnippet = '';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout
      
      const fetchRes = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (fetchRes.ok) {
        const html = await fetchRes.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        
        const title = titleMatch ? titleMatch[1] : '';
        const metaDesc = metaMatch ? metaMatch[1] : '';
        
        const bodyClean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                              .replace(/<[^>]+>/g, ' ')
                              .replace(/\s+/g, ' ')
                              .slice(0, 1500);

        pageSnippet = `Título de la página: "${title}". Descripción Meta: "${metaDesc}". Contenido descubierto: ${bodyClean}`;
        console.log('Metadatos iniciales recolectados de la URL exitosamente.');
      }
    } catch (err) {
      console.log('[Info] Falló la descarga html directa o superó el tiempo.');
    }

    try {
      let ai;
      try {
        ai = getGemini();
      } catch (keyErr) {
        console.log('[API Limit Note] No Gemini key found. Using smart fallback.');
        const result = getSmartFallbackFromUrl(targetUrl, pageSnippet);
        return res.json(result);
      }

      const promptString = `Analiza detalladamente este sitio web comercial para configurar una demostración de punto de venta y reparto inteligente:
Sitio web URL: "${targetUrl}"
Información previa extraída directamente: "${pageSnippet}"

Tu tarea es usar la herramienta de búsqueda de Google para encontrar información verídica, actual e impecable de este negocio, marca o restaurante. Investiga:
1. Su nombre real o comercial.
2. Qué tipo de productos vende (por ejemplo, si es Nayaritas.mx, vende productos tradicionales de Nayarit como tortillas de maíz, tostadas raspadas, salsas caseras, dulces típicos o marisquería).
3. Una lista de 4 a 6 de sus productos estrella reales, con precios razonables aproximados en pesos convertido a centavos (ejemplo: $35.00 MXN es 3500 centavos, $120.00 MXN es 12000 centavos).
4. Su combinación de color principal (branding/logotipo).
5. Un subtítulo o slogan comercial amigable.

Genera un archivo de configuración JSON perfectamente detallado y en español de México.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptString,
        config: {
          systemInstruction: 'Eres "RoutePro Web Crawler AI". Buscas de forma confiable información comercial de marcas o restaurantes en base a su URL y produces una configuración de negocio estructurada en formato JSON estricto.',
          tools: [{ googleSearch: {} }],
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nombre: { type: Type.STRING, description: 'Brand or business name' },
              letra: { type: Type.STRING, description: '1-3 Capital letters for the Logo seal emblem' },
              subtitulo: { type: Type.STRING, description: 'A realistic slogan/subtitle matching this specific brand' },
              color_principal: { type: Type.STRING, description: 'A gorgeous brand color matching the company logo or primary palette (hex format like #C9912A)' },
              productos: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    icono: { type: Type.STRING, description: 'Single emoji representing this specific product item' },
                    nombre: { type: Type.STRING, description: 'Human product item name matching what they actually sell (e.g. Tostadas Caseras, etc.)' },
                    precio: { type: Type.INTEGER, description: 'Actual or approximate market price in centvs MXN (e.g., $45.00 MXN = 4500)' },
                    unidad: { type: Type.STRING, description: 'Unit: pza, kg, lt, garrafón, caja, pac, charola, orden, porción' }
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
                    nombre: { type: Type.STRING, description: 'Realistic typical Mexican name for a staff team member' },
                    rol: { type: Type.STRING, description: 'Can be "repartidor", "cajero" or "ambos" depending on the client business style' },
                    ruta: { type: Type.STRING, description: 'Creative and realistic route name matching their home region or city area' }
                  },
                  required: ['id', 'nombre', 'rol', 'ruta']
                }
              }
            },
            required: ['nombre', 'letra', 'subtitulo', 'color_principal', 'productos', 'vendedores']
          }
        }
      });

      const responseText = response.text || '';
      const result = JSON.parse(responseText.trim());
      console.log('Result of URL Scraper Config:', result);
      res.json(result);
    } catch (apiError: any) {
      // Gracefully log note of rate limits without triggering severe screaming errors in platform logs
      console.log('[API Limit Note] Note: Utilizing smart semantic fallback config due to API load:', apiError?.message || apiError);
      const fallbackResult = getSmartFallbackFromUrl(targetUrl, pageSnippet);
      res.json(fallbackResult);
    }
  });

  // API for corporate image brand logo generation based on brand name and colors
  app.post('/api/generate-logo', async (req, res) => {
    try {
      const { businessName, color, description, style, icon } = req.body;
      if (!businessName) {
        return res.status(400).json({ error: 'Falta el nombre del negocio' });
      }

      let ai;
      try {
        ai = getGemini();

        // 1. Utilize Gemini's text model intelligence to craft a beautiful, high-quality, professional logo prompt (chido)
        const promptExpansionResponse = await ai.models.generateContent({
          model: 'gemini-3.5-flash',
          contents: `You are an veteran design officer and elite brand identity strategist. 
Expand the following query into a beautiful, extremely polished, highly detailed English prompt suitable for a modern image-generation model (like gemini-2.5-flash-image) to create a stunning, visually awesome ("bien chido") app logo.

Business/Brand Name: "${businessName}"
Primary Color Accent: "${color || '#C9912A'}"
Core Concept: "${description || 'Logística y distribución comercial'}"
Style Direction: "${style || 'modern'}"
Suggested Icon/Symbol: "${icon || 'emblem'}"

Your English prompt MUST describe:
- A clean, masterfully crafted minimalist corporate logo or modern app icon.
- Elegant use of the accent color "${color || '#C9912A'}", paired with high contrast neutrals (e.g. deep charcoal or solid white background).
- Visual elements representing "${icon || 'emblem'}" seamlessly integrated with the brand spirit.
- Flat vector aesthetic, clean geometric lines, beautiful proportions, centered layout, generous margin padding.
- Highly professional, sleek, and memorable ("chido") corporate brand feel.
- Explicit instructions: "flat design, clean vector art, no photorealistic noise, solid plain background, isolated centered icon, perfect for app store icon".

OUTPUT ONLY the optimized final prompt text in plain English. Do not add intro, markdown styling, explanation or quotes.`,
        });

        const optimizedPrompt = (promptExpansionResponse.text || '').trim();
        console.log('Gemini text intelligence crafted this prompt:', optimizedPrompt);

        // Create an API v1 client specifically for stable image generation support (fixes 404 on v1beta)
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error('GEMINI_API_KEY environment variable is required');
        }
        const aiV1Client = new GoogleGenAI({
          apiKey,
          apiVersion: 'v1',
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        });

        // 2. Multi-tier Image Generation Strategy
        let base64ImageBytes = null;
        let usedMethod = '';

        // ATTEMPT A: Default to Stable Imagen 3 (imagen-3.0-generate-002) on v1 endpoint via generateImages (GA standard)
        try {
          console.log('Attempting image generation with imagen-3.0-generate-002 on v1 API...');
          const imageResponse = await aiV1Client.models.generateImages({
            model: 'imagen-3.0-generate-002',
            prompt: optimizedPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/png',
              aspectRatio: '1:1',
            },
          });

          if (imageResponse?.generatedImages?.[0]?.image?.imageBytes) {
            base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
            usedMethod = 'imagen-3.0-generate-002 (v1)';
            console.log('Successfully generated logo image using Stable Imagen 3!');
          }
        } catch (err: any) {
          console.log('[Info] Imagen 3 v1 no disponible o requiere clave de facturación de pago.');
        }

        // ATTEMPT B: Fallback to lightweight 'gemini-2.5-flash-image' on v1beta API via generateContent (Standard Experimental/Beta path)
        if (!base64ImageBytes) {
          try {
            console.log('Attempting image generation with gemini-2.5-flash-image on v1beta API...');
            const imageResponse = await ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: {
                parts: [
                  {
                    text: optimizedPrompt,
                  },
                ],
              },
              config: {
                imageConfig: {
                  aspectRatio: '1:1',
                },
              },
            });

            if (imageResponse?.candidates?.[0]?.content?.parts) {
              for (const part of imageResponse.candidates[0].content.parts) {
                if (part.inlineData) {
                  base64ImageBytes = part.inlineData.data;
                  usedMethod = 'gemini-2.5-flash-image (v1beta)';
                  console.log('Successfully generated logo image using gemini-2.5-flash-image on v1beta!');
                  break;
                }
              }
            }
          } catch (err: any) {
            console.log('[Info] Gemini 2.5 Flash Image v1beta no disponible o cuota de imagen superada.');
          }
        }

        if (base64ImageBytes) {
          const logoDataUrl = `data:image/png;base64,${base64ImageBytes}`;
          console.log(`Successfully completed logo generation using method: ${usedMethod}`);
          return res.json({ 
            logo_url: logoDataUrl,
            optimized_prompt: optimizedPrompt,
            is_fallback: false,
            generation_method: usedMethod
          });
        } else {
          throw new Error('Todas las llamadas del modelo de imágenes de Gemini fallaron o no contuvieron datos.');
        }
      } catch (err: any) {
        console.log('[Info] El modelo de imágenes no está disponible bajo la licencia/clave actual. Activando motor vectorial local...');
        
        // Dynamic custom vector SVG fallback perfectly stylized and dynamic based on colors & initials!
        const col = color || '#C9912A';
        const initial = (businessName || 'M').substring(0, 3).toUpperCase();
        const emo = icon || '🏪';
        
        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
          <defs>
            <radialGradient id="grad1" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <stop offset="0%" style="stop-color:#151B2B;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#0E121F;stop-opacity:1" />
            </radialGradient>
            <linearGradient id="gradColor" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${col};stop-opacity:0.9" />
              <stop offset="100%" style="stop-color:#ffffff;stop-opacity:0.25" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="8" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <rect width="400" height="400" fill="url(#grad1)" rx="80" />
          <circle cx="200" cy="200" r="160" stroke="${col}" stroke-width="4" stroke-dasharray="10, 5" fill="none" opacity="0.3" />
          <circle cx="200" cy="200" r="145" stroke="url(#gradColor)" stroke-width="8" fill="#111520" filter="url(#glow)" />
          <text x="200" y="165" font-size="90" text-anchor="middle" dominant-baseline="middle">${emo}</text>
          <text x="200" y="260" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="42" fill="#FFFFFF" text-anchor="middle" letter-spacing="1">${initial}</text>
          <text x="200" y="310" font-family="monospace" font-weight="800" font-size="12" fill="${col}" text-anchor="middle" letter-spacing="3">ROUTEPRO ELITE</text>
          <line x1="120" y1="285" x2="280" y2="285" stroke="${col}" stroke-width="2" opacity="0.4" />
        </svg>`;

        const base64Svg = Buffer.from(svgString).toString('base64');
        const logoDataUrl = `data:image/svg+xml;base64,${base64Svg}`;
        
        return res.json({ 
          logo_url: logoDataUrl, 
          is_fallback: true,
          message: 'Logo corporativo vectorizado generado en base a tu color.' 
        });
      }
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Fallo al procesar generación de logotipo corporativo' });
    }
  });

  // API Route for server-side business intelligence chat (chatbot in Panel del Dueño)
  app.post('/api/chat', async (req, res) => {
    try {
      const { question, config_negocio, ventas, vendedores, chatHistory } = req.body;

      let ai;
      try {
        ai = getGemini();
      } catch (err) {
        // Fallback offline answers if no Gemini API Key is configured yet, incorporating time, calendar, CDS and Mystery Shop skills
        const qLower = (question || '').toLowerCase();
        let ans = 'Asistente Corporativo (Modo Local): ';
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        const dateStr = now.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        if (qLower.includes('hora') || qLower.includes('tiempo') || qLower.includes('reloj')) {
          ans += `La hora local en el Centro de Distribución (CDS) es exactamente las ${timeStr}.`;
        } else if (qLower.includes('calendario') || qLower.includes('fecha') || qLower.includes('dia') || qLower.includes('día')) {
          ans += `La fecha operativa en el calendario es ${dateStr}. Útil para calendarizar despachos y optimizar descansos de choferes.`;
        } else if (qLower.includes('misterioso') || qLower.includes('mystery') || qLower.includes('auditor') || qLower.includes('shop')) {
          ans += `El Módulo de Cliente Misterioso está activo para validar que los choferes cobren precios oficiales del catálogo, entreguen recibos/tickets impresos, cuiden la limpieza del uniforme y den un trato cortés de bienvenida en calle.`;
        } else if (qLower.includes('cds') || qLower.includes('centro') || qLower.includes('cedis') || qLower.includes('distribucion') || qLower.includes('distribución')) {
          ans += `El CDS (Centro de Distribución) es el núcleo logístico de RoutePro. Coordina la asignación sugerida por IA de mermas y devoluciones, reduciendo viajes redundantes y abaratando costos de combustible.`;
        } else if (qLower.includes('sesio') || qLower.includes('turno') || qLower.includes('flujo') || qLower.includes('etapa')) {
          ans += `Estructura de la Sesión del Repartidor: 1) Check-In en el CDS con carga sugerida por IA. 2) Ventas sincronizadas en vivo con emisión de recibo en calle. 3) Retorno al CDS para conciliación de caja de sucursal contra inventario entregado y Check-Out de liquidación financiera segura.`;
        } else if (qLower.includes('ruta') || qLower.includes('vendedor')) {
          ans += `Contamos con ${vendedores?.length || 0} rutas de reparto registradas. Total de transacciones hoy: ${ventas?.length || 0} ventas validadas y sincronizadas al instante.`;
        } else if (qLower.includes('efectivo') || qLower.includes('dinero') || qLower.includes('caja')) {
          const tot = (ventas || []).reduce((sum: number, v: any) => sum + (v.monto || 0), 0);
          ans += `La caja acumulada reportada en calle hoy asciende a $${(tot / 100).toFixed(2)}. Listo para reconciliar en terminal de almacén central del CEDIS.`;
        } else {
          ans += `Se registraron ${ventas?.length || 0} ventas totales hoy. Pregúntame sobre la hora del CDS, calendario logístico, estructura de las sesiones de usuario o las auditorías de Cliente Misterioso.`;
        }
        return res.json({ text: ans });
      }

      // Build context for Gemini
      const businessName = config_negocio?.nombre || 'Mi Negocio';
      const productsStr = JSON.stringify(config_negocio?.productos || []);
      const activeSellersStr = JSON.stringify(vendedores || []);
      
      const salesOverview = (ventas || []).map((v: any) => ({
        vendedor: v.vendedor_nombre || v.vendedorNombre,
        monto: v.monto ? (v.monto / 100).toFixed(2) : '0.00',
        tipoCobro: v.tipo_cobro || v.tipoCobro,
        cliente: v.cliente_nombre || v.clienteNombre,
        hora: v.hora,
        items: v.productos || v.items
      }));

      const localTimeStr = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const localDateStr = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      const contextPrompt = `Eres el Asesor Financiero e Inteligente de la plataforma corporativa RoutePro para "${businessName}". 
El dueño del negocio se está comunicando en tiempo real contigo para auditar finanzas, monitorear la sucursal y coordinar el personal.

=== Habilidades de Tiempo y Calendario (Time & Calendar Skills) ===
- Se te ha enseñado a manejar el tiempo oficial de la sucursal y usar agendas de turnos.
- La HORA LOCAL actual en el Centro de Distribución es: ${localTimeStr}
- La FECHA actual en el calendario operativo es: ${localDateStr} (Úsala para aconsejar sobre calendarios de rutas, planificar despachos u organizar descansos semanales de conductores).

=== Conocimiento del CDS (Centro de Distribución) y Rutas ===
- Sabes perfectamente qué es un CDS/CEDIS (Centro de Distribución) y eres especialista en la optimización de rutas de última milla.
- Entiendes el flujo logístico de asignación de carga inicial, rebalanceo para evitar desabastos, manejo de mermas y devolución de inventario no vendido al almacén central.
- Aconsejas al usuario sobre la planeación geográfica de drops por colonia, la optimización de traslados vehiculares y cómo reducir tiempos de ruta o consumos redundantes de combustible.

=== Estructuración de Sesiones de Usuario (User Shifts / Session Engineering) ===
- Posees metodologías claras para estructurar las jornadas de los repartidores. Una sesión típica se divide en tres fases críticas:
  1. Check-In de Carga Central: El repartidor reporta al CDS por la mañana, carga la mercancía sugerida según demanda predictiva y valida su inventario de salida.
  2. Transacciones Validadas en Calle: Realiza visitas geolocalizadas, imprime recibos/tickets y sincroniza cada cobro (efectivo/crédito) para evitar ventas no registradas.
  3. Check-Out de Liquidación (Cierre Financiero): Retorna al CEDIS, registra unidades merma o devueltas, confronta el dinero cobrado contra el inventario faltante y liquida su saldo.

=== Módulo Activo de Cliente Misterioso (Mystery Shop) ===
- El sistema tiene activas auditorías de "Cliente Misterioso" (auditorías encubiertas) para blindar el negocio ante fraudes o fallas operativas de choferes.
- Sabes que un Mystery Shopper audita de forma anónima en calle 4 pilares:
  1. Cobro Exacto: Que el chofer respete las tarifas oficiales del catálogo (evita el "robo hormiga" o sobreprecio).
  2. Entrega de Recibo: Que registre la transacción en vivo en su panel en lugar de quedarse con el efectivo offline.
  3. Presentación y Limpieza: Orden de la mercancía, higiene y uniforme reglamentario limpio.
  4. Trato Cortés: Que el trato al cliente sea de amabilidad, agilidad y cortesía.

=== Datos en Vivo del Negocio ===
A) Catálogo Corporativo de Productos autorizados: ${productsStr}
B) Vendedores/Repartidores vigentes: ${activeSellersStr}
C) Transacciones de hoy recibidas en vivo en el Cdis: ${JSON.stringify(salesOverview)}

Historial de chat reciente:
${JSON.stringify(chatHistory || [])}

Pregunta o instrucción: "${question}"

Instrucciones de Respuesta:
1. Responde de manera profesional, breve, concisa y altamente resolutiva (máximo 3-4 líneas).
2. Usa modismos educados, profesionales y amigables de español de México.
3. Si el usuario te pregunta por la hora o fecha actual de la sucursal, respóndela con cortesía utilizando los datos provistos.
4. Apóyalos con ideas brillantes sobre planeación y cómo medir el cumplimiento de los empleados mediante auditorías misteriosas.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: contextPrompt,
        config: {
          temperature: 0.7,
        }
      });

      res.json({ text: response.text || 'Sin respuesta del modelo.' });
    } catch (error) {
      console.error('Chat error:', error);
      res.json({ text: 'Lo siento, ocurrió un error analizando los datos financieros. Inténtalo de nuevo.' });
    }
  });

  // Enable Vite middleware in dev, otherwise serve built bundle
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
