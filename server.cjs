var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
var aiClient = null;
function getGemini() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new import_genai.GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: Date.now() });
  });
  app.post("/api/predict", async (req, res) => {
    try {
      const { vendedorNombre, diaSemana, productos, recentActivity } = req.body;
      let ai;
      try {
        ai = getGemini();
      } catch (keyErr) {
        const factor = diaSemana === "S\xE1bado" || diaSemana === "Domingo" ? 1.25 : 1;
        const recomendaciones = (productos || []).map((p) => ({
          productId: p.id,
          cantidad: Math.round((p.defaultCarga || 30) * factor)
        }));
        return res.json({
          recomendaciones,
          explicacion: `Sugerencia heur\xEDstica offline para ${diaSemana}: Se increment\xF3 un 25% el stock promedio estimado por fin de semana.`
        });
      }
      const promptString = `Estima la carga de ruta inteligente para hoy para el vendedor: "${vendedorNombre}".
Hoy es d\xEDa: ${diaSemana}.
Los productos configurados en el cat\xE1logo corporativo son:
${JSON.stringify(productos || [])}

Actividad reciente en el panel:
${recentActivity || "Servicios ordinarios en las \xFAltimas jornadas de reparto."}

Sugerir un inventario ideal de salida para cada producto en el cat\xE1logo. Retorna un ajuste inteligente basado en el giro de negocio y el d\xEDa de la semana.`;
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: promptString,
        config: {
          systemInstruction: 'Eres "RoutePro Elite AI", una inteligencia artificial que ayuda a due\xF1os de negocios m\xF3viles de distribuci\xF3n, reparto o venta a optimizar la salida de inventario de sus veh\xEDculos. Minimiza p\xE9rdidas, calcula mermas y asegura abasto seg\xFAn el d\xEDa de la semana.',
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai.Type.OBJECT,
            properties: {
              recomendaciones: {
                type: import_genai.Type.ARRAY,
                items: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    productId: { type: import_genai.Type.STRING },
                    cantidad: { type: import_genai.Type.INTEGER, description: "Cantidad \xF3ptima estimada" }
                  },
                  required: ["productId", "cantidad"]
                }
              },
              explicacion: {
                type: import_genai.Type.STRING,
                description: "Breve explicaci\xF3n de 1 o 2 renglones en espa\xF1ol mexicano sobre la l\xF3gica del ajuste de carga hoy."
              }
            },
            required: ["recomendaciones", "explicacion"]
          }
        }
      });
      const responseText = response.text || "";
      const result = JSON.parse(responseText.trim());
      res.json(result);
    } catch (error) {
      console.error("Gemini prediction error:", error);
      const fallbackRecs = (req.body.productos || []).map((p) => ({
        productId: p.id,
        cantidad: 30
      }));
      res.json({
        recomendaciones: fallbackRecs,
        explicacion: "Inventario habitual recomendado de seguridad (contingencia por intermitencia de red o API)."
      });
    }
  });
  app.post("/api/generate-config", async (req, res) => {
    try {
      const { description } = req.body;
      if (!description) {
        return res.status(400).json({ error: "Falta la descripci\xF3n del negocio" });
      }
      let ai;
      try {
        ai = getGemini();
      } catch (err) {
        const desc = (description || "").toLowerCase();
        let name = "Distribuidora Express";
        let sub = "Servicios a domicilio profesionales";
        let letra = "D";
        let col = "#00C896";
        let prods = [
          { id: "P_F1", icono: "\u{1F4E6}", nombre: "Caja est\xE1ndar general", precio: 5e3, unidad: "caja" },
          { id: "P_F2", icono: "\u{1F69A}", nombre: "Paquete de entrega", precio: 1500, unidad: "pza" },
          { id: "P_F3", icono: "\u{1F3F7}\uFE0F", nombre: "Surtido premium", precio: 12e3, unidad: "pac" }
        ];
        if (desc.includes("pan") || desc.includes("bakery")) {
          name = "Pasteler\xEDa El Trigo Dorado";
          letra = "T";
          sub = "Pan caliente a domicilio";
          col = "#C9822A";
          prods = [
            { id: "P_F1", icono: "\u{1F35E}", nombre: "Pan Bolillo", precio: 200, unidad: "pza" },
            { id: "P_F2", icono: "\u{1F956}", nombre: "Teleras bolsa", precio: 600, unidad: "pac" },
            { id: "P_F3", icono: "\u{1F9C1}", nombre: "Pan dulce surtido", precio: 1500, unidad: "caja" }
          ];
        } else if (desc.includes("agua") || desc.includes("pure")) {
          name = "Purificadora Manantial H2O";
          letra = "M";
          sub = "Agua fresca y purificada";
          col = "#4A8FFF";
          prods = [
            { id: "P_F1", icono: "\u{1F4A7}", nombre: "Garraf\xF3n 20L", precio: 3500, unidad: "garraf\xF3n" },
            { id: "P_F2", icono: "\u{1FAD9}", nombre: "Botell\xF3n 10L", precio: 2e3, unidad: "botell\xF3n" },
            { id: "P_F3", icono: "\u{1F504}", nombre: "Intercambio r\xE1pido", precio: 3e3, unidad: "pza" }
          ];
        }
        return res.json({
          nombre: name,
          letra,
          subtitulo: sub,
          color_principal: col,
          productos: prods,
          vendedores: [
            { id: "V_F1", nombre: "Carlos Mendoza", rol: "repartidor", ruta: "Ruta Oriente" },
            { id: "V_F2", nombre: "Gaby Solis", rol: "cajero", ruta: "Mostrador Central" }
          ]
        });
      }
      const promptString = `Genera una configuraci\xF3n completa de negocio para "RoutePro" basada en la siguiente descripci\xF3n dada por el usuario:
"${description}"

Establece un nombre de marca elegante en espa\xF1ol mexicano, un subt\xEDtulo descriptivo, una letra de logotipo (1 o 2 letras), un color hexadecimal primario hermoso que combine, una lista de 4 a 6 productos estrella realistas con precios detallados en centavos (ej: $18.50 pesos es 1850 cents, $100.00 pesos es 10000 cents) y unidades correctas, y una lista de 2 a 3 trabajadores mexicanos en sus respectivas rutas.`;
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: promptString,
        config: {
          systemInstruction: 'Eres "RoutePro Setup Engine", un formateador estructurado que genera configuraciones de negocio instant\xE1neas, profesionales y realistas para due\xF1os de empresas de distribuci\xF3n, mostrador o ventas m\xF3viles.',
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai.Type.OBJECT,
            properties: {
              nombre: { type: import_genai.Type.STRING, description: "Brand name" },
              letra: { type: import_genai.Type.STRING, description: "1-2 caps abbreviation for Logo stamp" },
              subtitulo: { type: import_genai.Type.STRING, description: "Catchy professional description" },
              color_principal: { type: import_genai.Type.STRING, description: "Theme hex color code" },
              productos: {
                type: import_genai.Type.ARRAY,
                items: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    id: { type: import_genai.Type.STRING },
                    icono: { type: import_genai.Type.STRING, description: "Single emoji representing product" },
                    nombre: { type: import_genai.Type.STRING, description: "Item name" },
                    precio: { type: import_genai.Type.INTEGER, description: "Standard wholesale price in cents MXN (e.g., $18.50 MXN = 1850)" },
                    unidad: { type: import_genai.Type.STRING, description: "Unit descriptor: pza, kg, lt, garraf\xF3n, botell\xF3n, caja, pac" }
                  },
                  required: ["id", "icono", "nombre", "precio", "unidad"]
                }
              },
              vendedores: {
                type: import_genai.Type.ARRAY,
                items: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    id: { type: import_genai.Type.STRING },
                    nombre: { type: import_genai.Type.STRING, description: "Employee name" },
                    rol: { type: import_genai.Type.STRING, description: 'Must be "repartidor", "cajero" or "ambos"' },
                    ruta: { type: import_genai.Type.STRING, description: "Sub-territory / Zone name" }
                  },
                  required: ["id", "nombre", "rol", "ruta"]
                }
              }
            },
            required: ["nombre", "letra", "subtitulo", "color_principal", "productos", "vendedores"]
          }
        }
      });
      const result = JSON.parse((response.text || "{}").trim());
      res.json(result);
    } catch (error) {
      console.error("Error generating AI config:", error);
      res.status(500).json({ error: "Error procesando la solicitud con IA" });
    }
  });
  function getSmartFallbackFromUrl(url, pageSnippet) {
    let domain = "Negocio";
    try {
      const cleanUrl = url.replace(/^(https?:\/\/)?(www\.)?/, "");
      const firstPart = cleanUrl.split("/")[0];
      const namePart = firstPart.split(".")[0];
      if (namePart) {
        domain = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      }
    } catch (e) {
    }
    let titleExcerpt = "";
    if (pageSnippet) {
      const titleMatch = pageSnippet.match(/Título de la página:\s*"([^"]+)"/);
      if (titleMatch && titleMatch[1]) {
        titleExcerpt = titleMatch[1].trim();
      }
    }
    let nombre = domain;
    if (titleExcerpt && titleExcerpt.length > 3) {
      const cleanedTitle = titleExcerpt.split(/[|•\-\n]/)[0].trim();
      if (cleanedTitle && cleanedTitle.length < 35 && cleanedTitle.length > 2) {
        nombre = cleanedTitle;
      }
    }
    const normalizedLower = (url + " " + pageSnippet + " " + nombre).toLowerCase();
    if (normalizedLower.includes("nayarit") || normalizedLower.includes("tostada") || normalizedLower.includes("tortilla") || normalizedLower.includes("salsa") || normalizedLower.includes("huichol") || normalizedLower.includes("marisco") || normalizedLower.includes("comida") || normalizedLower.includes("antojo") || normalizedLower.includes("queso") || normalizedLower.includes("sabor")) {
      return {
        nombre: nombre === "Negocio" ? "Nayaritas Tradicional" : nombre,
        letra: nombre.substring(0, 2).toUpperCase() || "NY",
        subtitulo: "Tortillas, tostadas y el aut\xE9ntico sabor de Nayarit",
        color_principal: "#D97706",
        productos: [
          { id: "PH_F1", icono: "\u{1FAD3}", nombre: "Tostadas Raspadas (Paquete Familiar)", precio: 3800, unidad: "pac" },
          { id: "PH_F2", icono: "\u{1F32E}", nombre: "Tortilla de Ma\xEDz Nixtamalizado (1 Kg)", precio: 2400, unidad: "kg" },
          { id: "PH_F3", icono: "\u{1F336}\uFE0F", nombre: "Salsa Picante Huichol Tradicional", precio: 1900, unidad: "pza" },
          { id: "PH_F4", icono: "\u{1F9C0}", nombre: "Queso Cotija Seco Madurado", precio: 9500, unidad: "kg" },
          { id: "PH_F5", icono: "\u{1F4E6}", nombre: "Tostadas Deshidratadas S\xFAper Crujientes", precio: 3500, unidad: "pac" }
        ],
        vendedores: [
          { id: "VH_F1", nombre: "Juan Pablo D\xEDaz", rol: "repartidor", ruta: "Ruta Costa y Huajicori" },
          { id: "VH_F2", nombre: "Alondra Ba\xF1ales", rol: "cajero", ruta: "Mostrador Tepic Centro" }
        ]
      };
    }
    if (normalizedLower.includes("agua") || normalizedLower.includes("purif") || normalizedLower.includes("oasis") || normalizedLower.includes("hielo") || normalizedLower.includes("aqua") || normalizedLower.includes("vital")) {
      return {
        nombre: nombre === "Negocio" ? "Agua Purificada Oasis" : nombre,
        letra: "H2O",
        subtitulo: "Hidrataci\xF3n pura y reparto confiable a domicilio",
        color_principal: "#0284C7",
        productos: [
          { id: "PH_W1", icono: "\u{1F4A7}", nombre: "Garraf\xF3n 20L Agua Purificada", precio: 4500, unidad: "garraf\xF3n" },
          { id: "PH_W2", icono: "\u{1F504}", nombre: "Relleno de Garraf\xF3n (Sucursal)", precio: 1800, unidad: "pza" },
          { id: "PH_W3", icono: "\u{1F9CA}", nombre: "Bolsa de Hielo en Cubo (5 Kg)", precio: 3200, unidad: "caja" },
          { id: "PH_W4", icono: "\u{1F964}", nombre: "Paquete de Vasos Cono Desechables", precio: 4e3, unidad: "pac" }
        ],
        vendedores: [
          { id: "VH_W1", nombre: "Andr\xE9s L\xF3pez", rol: "repartidor", ruta: "Ruta Residenciales" },
          { id: "VH_W2", nombre: "Estela Mart\xEDnez", rol: "cajero", ruta: "Despacho Avenida" }
        ]
      };
    }
    if (normalizedLower.includes("cafe") || normalizedLower.includes("coffee") || normalizedLower.includes("pan") || normalizedLower.includes("bakery") || normalizedLower.includes("panaderia") || normalizedLower.includes("postre") || normalizedLower.includes("pastel")) {
      return {
        nombre: nombre === "Negocio" ? "Panader\xEDa La Concha de Oro" : nombre,
        letra: nombre.substring(0, 1).toUpperCase() || "P",
        subtitulo: "Aroma fresco y reposter\xEDa artesanal horneada hoy",
        color_principal: "#B45309",
        productos: [
          { id: "PH_B1", icono: "\u{1F950}", nombre: "Conchas Surtidas Reci\xE9n Horneadas (6 Pzs)", precio: 4500, unidad: "pac" },
          { id: "PH_B2", icono: "\u{1F956}", nombre: "Bolillo R\xFAstico Calientito (10 Pzs)", precio: 3e3, unidad: "pac" },
          { id: "PH_B3", icono: "\u2615", nombre: "Caf\xE9 de Olla Molido Org\xE1nico (1 Kg)", precio: 19500, unidad: "kg" },
          { id: "PH_B4", icono: "\u{1F370}", nombre: "Pastel de Tres Leches Tradicional", precio: 24e3, unidad: "pza" }
        ],
        vendedores: [
          { id: "VH_B1", nombre: "Fernando Ruiz", rol: "repartidor", ruta: "Ruta Cafeter\xEDas del Valle" },
          { id: "VH_B2", nombre: "Luc\xEDa Ben\xEDtez", rol: "cajero", ruta: "Matriz Despacho" }
        ]
      };
    }
    return {
      nombre: nombre === "Negocio" ? "Distribuidora Express" : nombre,
      letra: nombre.substring(0, 2).toUpperCase() || "D",
      subtitulo: "Cat\xE1logo premium y entrega inteligente en tu zona",
      color_principal: "#10B981",
      productos: [
        { id: "PH_G1", icono: "\u{1F4E6}", nombre: "Paquete Comercial Soluci\xF3n Completa", precio: 15e3, unidad: "caja" },
        { id: "PH_G2", icono: "\u2728", nombre: "Accesorio Especial Durabilidad M\xE1xima", precio: 4800, unidad: "pza" },
        { id: "PH_G3", icono: "\u{1F6E1}\uFE0F", nombre: "Suscripci\xF3n de Soporte y Repuestos", precio: 8500, unidad: "pza" },
        { id: "PH_G4", icono: "\u{1F3F7}\uFE0F", nombre: "Lote de Consumibles B\xE1sicos de la Casa", precio: 29900, unidad: "caja" }
      ],
      vendedores: [
        { id: "VH_G1", nombre: "Santiago Morales", rol: "repartidor", ruta: "Ruta Metropolitana Este" },
        { id: "VH_G2", nombre: "Diana Cabrera", rol: "cajero", ruta: "Mostrador Central" }
      ]
    };
  }
  app.post("/api/generate-config-from-url", async (req, res) => {
    let { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Falta la direcci\xF3n URL del negocio" });
    }
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = "https://" + targetUrl;
    }
    console.log("Generando demo inteligente a partir del sitio web:", targetUrl);
    let pageSnippet = "";
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const fetchRes = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (fetchRes.ok) {
        const html = await fetchRes.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
        const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
        const title = titleMatch ? titleMatch[1] : "";
        const metaDesc = metaMatch ? metaMatch[1] : "";
        const bodyClean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "").replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 1500);
        pageSnippet = `T\xEDtulo de la p\xE1gina: "${title}". Descripci\xF3n Meta: "${metaDesc}". Contenido descubierto: ${bodyClean}`;
        console.log("Metadatos iniciales recolectados de la URL exitosamente.");
      }
    } catch (err) {
      console.log("[Info] Fall\xF3 la descarga html directa o super\xF3 el tiempo.");
    }
    try {
      let ai;
      try {
        ai = getGemini();
      } catch (keyErr) {
        console.log("[API Limit Note] No Gemini key found. Using smart fallback.");
        const result2 = getSmartFallbackFromUrl(targetUrl, pageSnippet);
        return res.json(result2);
      }
      const promptString = `Analiza detalladamente este sitio web comercial para configurar una demostraci\xF3n de punto de venta y reparto inteligente:
Sitio web URL: "${targetUrl}"
Informaci\xF3n previa extra\xEDda directamente: "${pageSnippet}"

Tu tarea es usar la herramienta de b\xFAsqueda de Google para encontrar informaci\xF3n ver\xEDdica, actual e impecable de este negocio, marca o restaurante. Investiga:
1. Su nombre real o comercial.
2. Qu\xE9 tipo de productos vende (por ejemplo, si es Nayaritas.mx, vende productos tradicionales de Nayarit como tortillas de ma\xEDz, tostadas raspadas, salsas caseras, dulces t\xEDpicos o marisquer\xEDa).
3. Una lista de 4 a 6 de sus productos estrella reales, con precios razonables aproximados en pesos convertido a centavos (ejemplo: $35.00 MXN es 3500 centavos, $120.00 MXN es 12000 centavos).
4. Su combinaci\xF3n de color principal (branding/logotipo).
5. Un subt\xEDtulo o slogan comercial amigable.

Genera un archivo de configuraci\xF3n JSON perfectamente detallado y en espa\xF1ol de M\xE9xico.`;
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: promptString,
        config: {
          systemInstruction: 'Eres "RoutePro Web Crawler AI". Buscas de forma confiable informaci\xF3n comercial de marcas o restaurantes en base a su URL y produces una configuraci\xF3n de negocio estructurada en formato JSON estricto.',
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai.Type.OBJECT,
            properties: {
              nombre: { type: import_genai.Type.STRING, description: "Brand or business name" },
              letra: { type: import_genai.Type.STRING, description: "1-3 Capital letters for the Logo seal emblem" },
              subtitulo: { type: import_genai.Type.STRING, description: "A realistic slogan/subtitle matching this specific brand" },
              color_principal: { type: import_genai.Type.STRING, description: "A gorgeous brand color matching the company logo or primary palette (hex format like #C9912A)" },
              productos: {
                type: import_genai.Type.ARRAY,
                items: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    id: { type: import_genai.Type.STRING },
                    icono: { type: import_genai.Type.STRING, description: "Single emoji representing this specific product item" },
                    nombre: { type: import_genai.Type.STRING, description: "Human product item name matching what they actually sell (e.g. Tostadas Caseras, etc.)" },
                    precio: { type: import_genai.Type.INTEGER, description: "Actual or approximate market price in centvs MXN (e.g., $45.00 MXN = 4500)" },
                    unidad: { type: import_genai.Type.STRING, description: "Unit: pza, kg, lt, garraf\xF3n, caja, pac, charola, orden, porci\xF3n" }
                  },
                  required: ["id", "icono", "nombre", "precio", "unidad"]
                }
              },
              vendedores: {
                type: import_genai.Type.ARRAY,
                items: {
                  type: import_genai.Type.OBJECT,
                  properties: {
                    id: { type: import_genai.Type.STRING },
                    nombre: { type: import_genai.Type.STRING, description: "Realistic typical Mexican name for a staff team member" },
                    rol: { type: import_genai.Type.STRING, description: 'Can be "repartidor", "cajero" or "ambos" depending on the client business style' },
                    ruta: { type: import_genai.Type.STRING, description: "Creative and realistic route name matching their home region or city area" }
                  },
                  required: ["id", "nombre", "rol", "ruta"]
                }
              }
            },
            required: ["nombre", "letra", "subtitulo", "color_principal", "productos", "vendedores"]
          }
        }
      });
      const responseText = response.text || "";
      const result = JSON.parse(responseText.trim());
      console.log("Result of URL Scraper Config:", result);
      res.json(result);
    } catch (apiError) {
      console.log("[API Limit Note] Note: Utilizing smart semantic fallback config due to API load:", apiError?.message || apiError);
      const fallbackResult = getSmartFallbackFromUrl(targetUrl, pageSnippet);
      res.json(fallbackResult);
    }
  });
  app.post("/api/generate-logo", async (req, res) => {
    try {
      const { businessName, color, description, style, icon } = req.body;
      if (!businessName) {
        return res.status(400).json({ error: "Falta el nombre del negocio" });
      }
      let ai;
      try {
        ai = getGemini();
        const promptExpansionResponse = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: `You are an veteran design officer and elite brand identity strategist. 
Expand the following query into a beautiful, extremely polished, highly detailed English prompt suitable for a modern image-generation model (like gemini-2.5-flash-image) to create a stunning, visually awesome ("bien chido") app logo.

Business/Brand Name: "${businessName}"
Primary Color Accent: "${color || "#C9912A"}"
Core Concept: "${description || "Log\xEDstica y distribuci\xF3n comercial"}"
Style Direction: "${style || "modern"}"
Suggested Icon/Symbol: "${icon || "emblem"}"

Your English prompt MUST describe:
- A clean, masterfully crafted minimalist corporate logo or modern app icon.
- Elegant use of the accent color "${color || "#C9912A"}", paired with high contrast neutrals (e.g. deep charcoal or solid white background).
- Visual elements representing "${icon || "emblem"}" seamlessly integrated with the brand spirit.
- Flat vector aesthetic, clean geometric lines, beautiful proportions, centered layout, generous margin padding.
- Highly professional, sleek, and memorable ("chido") corporate brand feel.
- Explicit instructions: "flat design, clean vector art, no photorealistic noise, solid plain background, isolated centered icon, perfect for app store icon".

OUTPUT ONLY the optimized final prompt text in plain English. Do not add intro, markdown styling, explanation or quotes.`
        });
        const optimizedPrompt = (promptExpansionResponse.text || "").trim();
        console.log("Gemini text intelligence crafted this prompt:", optimizedPrompt);
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          throw new Error("GEMINI_API_KEY environment variable is required");
        }
        const aiV1Client = new import_genai.GoogleGenAI({
          apiKey,
          apiVersion: "v1",
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build"
            }
          }
        });
        let base64ImageBytes = null;
        let usedMethod = "";
        try {
          console.log("Attempting image generation with imagen-3.0-generate-002 on v1 API...");
          const imageResponse = await aiV1Client.models.generateImages({
            model: "imagen-3.0-generate-002",
            prompt: optimizedPrompt,
            config: {
              numberOfImages: 1,
              outputMimeType: "image/png",
              aspectRatio: "1:1"
            }
          });
          if (imageResponse?.generatedImages?.[0]?.image?.imageBytes) {
            base64ImageBytes = imageResponse.generatedImages[0].image.imageBytes;
            usedMethod = "imagen-3.0-generate-002 (v1)";
            console.log("Successfully generated logo image using Stable Imagen 3!");
          }
        } catch (err) {
          console.log("[Info] Imagen 3 v1 no disponible o requiere clave de facturaci\xF3n de pago.");
        }
        if (!base64ImageBytes) {
          try {
            console.log("Attempting image generation with gemini-2.5-flash-image on v1beta API...");
            const imageResponse = await ai.models.generateContent({
              model: "gemini-2.5-flash-image",
              contents: {
                parts: [
                  {
                    text: optimizedPrompt
                  }
                ]
              },
              config: {
                imageConfig: {
                  aspectRatio: "1:1"
                }
              }
            });
            if (imageResponse?.candidates?.[0]?.content?.parts) {
              for (const part of imageResponse.candidates[0].content.parts) {
                if (part.inlineData) {
                  base64ImageBytes = part.inlineData.data;
                  usedMethod = "gemini-2.5-flash-image (v1beta)";
                  console.log("Successfully generated logo image using gemini-2.5-flash-image on v1beta!");
                  break;
                }
              }
            }
          } catch (err) {
            console.log("[Info] Gemini 2.5 Flash Image v1beta no disponible o cuota de imagen superada.");
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
          throw new Error("Todas las llamadas del modelo de im\xE1genes de Gemini fallaron o no contuvieron datos.");
        }
      } catch (err) {
        console.log("[Info] El modelo de im\xE1genes no est\xE1 disponible bajo la licencia/clave actual. Activando motor vectorial local...");
        const col = color || "#C9912A";
        const initial = (businessName || "M").substring(0, 3).toUpperCase();
        const emo = icon || "\u{1F3EA}";
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
        const base64Svg = Buffer.from(svgString).toString("base64");
        const logoDataUrl = `data:image/svg+xml;base64,${base64Svg}`;
        return res.json({
          logo_url: logoDataUrl,
          is_fallback: true,
          message: "Logo corporativo vectorizado generado en base a tu color."
        });
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Fallo al procesar generaci\xF3n de logotipo corporativo" });
    }
  });
  app.post("/api/chat", async (req, res) => {
    try {
      const { question, config_negocio, ventas, vendedores, chatHistory } = req.body;
      let ai;
      try {
        ai = getGemini();
      } catch (err) {
        const qLower = (question || "").toLowerCase();
        let ans = "Analizando tu consulta de forma local. ";
        if (qLower.includes("ruta") || qLower.includes("vendedor")) {
          ans += `Llevas un r\xE9cord de rutas activas hoy. Contamos con ${vendedores?.length || 0} integrantes registrados.`;
        } else if (qLower.includes("efectivo") || qLower.includes("dinero") || qLower.includes("caja")) {
          const tot = (ventas || []).reduce((sum, v) => sum + (v.monto || 0), 0);
          ans += `La caja general total acumulada hoy es de $${(tot / 100).toFixed(2)}.`;
        } else {
          ans += `Se registraron ${ventas?.length || 0} ventas totales hoy. Configura el GEMINI_API_KEY en Settings para activar asesor\xEDa en tiempo real con IA.`;
        }
        return res.json({ text: ans });
      }
      const businessName = config_negocio?.nombre || "Mi Negocio";
      const productsStr = JSON.stringify(config_negocio?.productos || []);
      const activeSellersStr = JSON.stringify(vendedores || []);
      const salesOverview = (ventas || []).map((v) => ({
        vendedor: v.vendedor_nombre,
        monto: v.monto ? (v.monto / 100).toFixed(2) : "0.00",
        tipoCobro: v.tipo_cobro || v.tipoCobro,
        cliente: v.cliente_nombre || v.nombre,
        hora: v.hora,
        items: v.productos || v.items
      }));
      const contextPrompt = `Eres el Asesor Financiero e Inteligente de "${businessName}". 
El due\xF1o del negocio se est\xE1 comunicando contigo en tiempo real para monitorear las finanzas, ventas de las rutas y rendimiento.
Configuraci\xF3n de Productos en Cat\xE1logo: ${productsStr}
Vendedores actuales de la corporaci\xF3n: ${activeSellersStr}
Resumen detallado de Ventas recibidas Hoy:
${JSON.stringify(salesOverview)}

Historial de conversaci\xF3n si lo hay:
${JSON.stringify(chatHistory || [])}

Pregunta del Due\xF1o: "${question}"

Instrucciones de Respuesta:
1. Responde de manera profesional, amigable y muy concisa (m\xE1ximo 3 l\xEDneas de texto).
2. Usa modismos educados de espa\xF1ol mexicano si se requiere.
3. Utiliza los datos econ\xF3micos reales anteriores para dar respuestas sumamente precisas y anal\xEDticas. Di exactamente qu\xE9 ruta vendi\xF3 m\xE1s, cu\xE1nto dinero hay en total, etc.`;
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: contextPrompt,
        config: {
          temperature: 0.7
        }
      });
      res.json({ text: response.text || "Sin respuesta del modelo." });
    } catch (error) {
      console.error("Chat error:", error);
      res.json({ text: "Lo siento, ocurri\xF3 un error analizando los datos financieros. Int\xE9ntalo de nuevo." });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
