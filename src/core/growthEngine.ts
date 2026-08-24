import type { Campaign, CampaignStatus } from './growth';
import { err, ok, type Result } from './result';

export type GrowthError = 'INVALID_TRANSITION' | 'APPROVAL_REQUIRED' | 'INVALID_BUDGET' | 'EMPTY_PRODUCT_SCOPE';

const transitions: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['approved', 'cancelled'],
  approved: ['scheduled', 'active', 'cancelled'],
  scheduled: ['active', 'paused', 'cancelled'],
  active: ['paused', 'completed', 'cancelled'],
  paused: ['active', 'completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export interface CreateCampaignInput {
  id: string;
  tenantId: string;
  businessId: string;
  name: string;
  objective: Campaign['objective'];
  productIds: string[];
  channels: Campaign['channels'];
  budgetCents?: number;
  createdBy: string;
  createdAt: number;
}

export function createCampaign(input: CreateCampaignInput): Result<Campaign, GrowthError> {
  if (!input.productIds.length) return err('EMPTY_PRODUCT_SCOPE');
  if (input.budgetCents !== undefined && input.budgetCents < 0) return err('INVALID_BUDGET');
  return ok({
    id: input.id,
    tenantId: input.tenantId,
    businessId: input.businessId,
    name: input.name,
    objective: input.objective,
    productIds: input.productIds,
    channels: input.channels,
    status: 'draft',
    budget: input.budgetCents === undefined ? undefined : { amountCents: input.budgetCents, currency: 'MXN' },
    createdBy: input.createdBy,
    createdAt: input.createdAt,
  });
}

export function approveCampaign(campaign: Campaign, approvedBy: string, at: number): Result<Campaign, GrowthError> {
  if (!transitions[campaign.status].includes('approved')) return err('INVALID_TRANSITION');
  return ok({ ...campaign, status: 'approved', approvedBy, approvedAt: at });
}

export function transitionCampaign(campaign: Campaign, status: CampaignStatus): Result<Campaign, GrowthError> {
  if (!transitions[campaign.status].includes(status)) return err('INVALID_TRANSITION', { from: campaign.status, to: status });
  if ((status === 'scheduled' || status === 'active') && !campaign.approvedBy) return err('APPROVAL_REQUIRED');
  return ok({ ...campaign, status });
}
