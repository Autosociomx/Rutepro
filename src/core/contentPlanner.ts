import type { Product } from './domain';

export interface ProductPerformance {
  productId: string;
  units: number;
  revenueCents: number;
  lastSoldAt?: number;
}

export interface ContentPlanInput {
  businessId: string;
  products: Product[];
  performance: ProductPerformance[];
  lastPublishedAt?: number;
  cadenceDays?: number;
  now: number;
}

export interface ContentBrief {
  businessId: string;
  productId: string;
  dueAt: number;
  objective: 'sales' | 'reengagement' | 'discovery';
  angle: string;
  evidence: string;
  requiresHumanApproval: true;
}

export function planNextContent(input: ContentPlanInput): ContentBrief | null {
  if (!input.products.length) return null;
  const cadenceDays = Math.min(14, Math.max(1, input.cadenceDays ?? 3));
  const dueAt = (input.lastPublishedAt ?? input.now) + cadenceDays * 86_400_000;
  const byProduct = new Map(input.performance.map(row => [row.productId, row]));

  const ranked = [...input.products]
    .filter(product => product.active)
    .map(product => ({ product, perf: byProduct.get(product.id) }))
    .sort((a, b) => (b.perf?.revenueCents ?? 0) - (a.perf?.revenueCents ?? 0));

  const selected = ranked[0] ?? { product: input.products[0], perf: undefined };
  const hasEvidence = (selected.perf?.revenueCents ?? 0) > 0;

  return {
    businessId: input.businessId,
    productId: selected.product.id,
    dueAt,
    objective: hasEvidence ? 'sales' : 'discovery',
    angle: hasEvidence
      ? `Convertir la tracción real de ${selected.product.name} en una pieza comercial clara.`
      : `Presentar ${selected.product.name} y medir respuesta antes de aumentar inversión.`,
    evidence: hasEvidence
      ? `${selected.perf?.units ?? 0} unidades y $${((selected.perf?.revenueCents ?? 0) / 100).toFixed(2)} MXN observados.`
      : 'Sin historial suficiente; usar publicación exploratoria de bajo riesgo.',
    requiresHumanApproval: true,
  };
}
