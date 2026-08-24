import type { CampaignOpportunity, CampaignOpportunityInput, IntelligenceProvider, LoadRecommendationInput, ProductLoadRecommendation } from './intelligence';

interface PredictResponse {
  recomendaciones?: Array<{ productId: string; cantidad: number }>;
  explicacion?: string;
}

const dayName = (day: number): string =>
  ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][day] ?? 'Día';

export class HttpAIIntelligenceProvider implements IntelligenceProvider {
  readonly name = 'http-ai';

  constructor(private readonly baseUrl = '') {}

  async recommendRouteLoad(input: LoadRecommendationInput): Promise<ProductLoadRecommendation[]> {
    const recentActivity = input.historicalSales.slice(-20).map(sale => ({
      totalCents: sale.total.amountCents,
      products: sale.items.map(item => ({
        id: item.productId,
        delivered: item.quantityDelivered,
        returned: item.quantityReturned,
      })),
    }));

    const response = await fetch(`${this.baseUrl}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendedorNombre: input.routeId,
        diaSemana: dayName(input.dayOfWeek),
        productos: input.products.map(product => ({
          id: product.id,
          nombre: product.name,
          unidad: product.unit,
          defaultCarga: 30,
        })),
        recentActivity: JSON.stringify(recentActivity),
      }),
    });

    if (!response.ok) throw new Error(`AI endpoint failed: ${response.status}`);
    const body = await response.json() as PredictResponse;
    if (!Array.isArray(body.recomendaciones)) throw new Error('Invalid AI response');

    return body.recomendaciones.map(rec => ({
      productId: rec.productId,
      suggestedQuantity: Math.max(0, Number(rec.cantidad) || 0),
      confidence: 0.7,
      reason: body.explicacion || 'Sugerencia generada por proveedor de IA',
    }));
  }

  async findCampaignOpportunities(_input: CampaignOpportunityInput): Promise<CampaignOpportunity[]> {
    throw new Error('Growth AI endpoint not configured');
  }
}
