import type { BusinessConfig } from './businessConfig';
import type { Product } from './domain';
import type { RouteSale } from './routes';

export type IntelligenceMode = 'rules' | 'ai' | 'hybrid';

export interface LoadRecommendationInput {
  routeId: string;
  products: Product[];
  historicalSales: RouteSale[];
  dayOfWeek: number;
}

export interface ProductLoadRecommendation {
  productId: string;
  suggestedQuantity: number;
  confidence: number;
  reason: string;
}

export interface CampaignOpportunityInput {
  businessId: string;
  products: Product[];
  salesByProduct: Array<{ productId: string; units: number; revenueCents: number }>;
}

export interface CampaignOpportunity {
  productId: string;
  score: number;
  reason: string;
}

export interface IntelligenceProvider {
  readonly name: string;
  recommendRouteLoad(input: LoadRecommendationInput): Promise<ProductLoadRecommendation[]>;
  findCampaignOpportunities(input: CampaignOpportunityInput): Promise<CampaignOpportunity[]>;
  improveBusinessConfig?(config: BusinessConfig): Promise<BusinessConfig>;
}

export class RulesIntelligenceProvider implements IntelligenceProvider {
  readonly name = 'deterministic-rules';

  async recommendRouteLoad(input: LoadRecommendationInput): Promise<ProductLoadRecommendation[]> {
    return input.products.map(product => {
      const relevantSales = input.historicalSales.filter(sale =>
        sale.items.some(item => item.productId === product.id),
      );

      const sold = relevantSales.reduce((total, sale) => {
        const item = sale.items.find(i => i.productId === product.id);
        if (!item) return total;
        return total + Math.max(0, item.quantityDelivered - item.quantityReturned);
      }, 0);

      const sample = Math.max(1, relevantSales.length);
      const mean = sold / sample;
      const safetyFactor = relevantSales.length >= 7 ? 1.08 : 1.15;
      const suggestedQuantity = Math.max(0, Math.ceil(mean * safetyFactor));
      const confidence = Math.min(0.88, 0.35 + relevantSales.length * 0.04);

      return {
        productId: product.id,
        suggestedQuantity,
        confidence,
        reason: relevantSales.length
          ? `Promedio histórico ${mean.toFixed(1)} + colchón operativo ${(safetyFactor * 100 - 100).toFixed(0)}%`
          : 'Sin historial suficiente; sugerencia conservadora',
      };
    });
  }

  async findCampaignOpportunities(input: CampaignOpportunityInput): Promise<CampaignOpportunity[]> {
    if (!input.salesByProduct.length) return [];
    const maxRevenue = Math.max(...input.salesByProduct.map(row => row.revenueCents), 1);
    return input.salesByProduct
      .map(row => ({
        productId: row.productId,
        score: Math.min(1, row.revenueCents / maxRevenue),
        reason: 'Prioridad basada en tracción comercial observable, sin IA externa',
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }
}

export class HybridIntelligenceProvider implements IntelligenceProvider {
  readonly name = 'hybrid-intelligence';

  constructor(
    private readonly fallback: IntelligenceProvider,
    private readonly ai?: IntelligenceProvider,
  ) {}

  async recommendRouteLoad(input: LoadRecommendationInput): Promise<ProductLoadRecommendation[]> {
    if (!this.ai) return this.fallback.recommendRouteLoad(input);
    try {
      const aiResult = await this.ai.recommendRouteLoad(input);
      if (!Array.isArray(aiResult) || aiResult.length === 0) throw new Error('AI returned empty recommendation');
      return aiResult;
    } catch {
      return this.fallback.recommendRouteLoad(input);
    }
  }

  async findCampaignOpportunities(input: CampaignOpportunityInput): Promise<CampaignOpportunity[]> {
    if (!this.ai) return this.fallback.findCampaignOpportunities(input);
    try {
      const aiResult = await this.ai.findCampaignOpportunities(input);
      if (!Array.isArray(aiResult)) throw new Error('AI returned invalid opportunity payload');
      return aiResult;
    } catch {
      return this.fallback.findCampaignOpportunities(input);
    }
  }

  async improveBusinessConfig(config: BusinessConfig): Promise<BusinessConfig> {
    if (!this.ai?.improveBusinessConfig) return config;
    try {
      return await this.ai.improveBusinessConfig(config);
    } catch {
      return config;
    }
  }
}

export const createIntelligence = (ai?: IntelligenceProvider): IntelligenceProvider =>
  new HybridIntelligenceProvider(new RulesIntelligenceProvider(), ai);
