import type { ID, Money } from './domain';

export type CampaignStatus = 'draft' | 'approved' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
export type CampaignChannel = 'facebook' | 'instagram' | 'tiktok' | 'whatsapp' | 'web' | 'other';

export interface Campaign {
  id: ID;
  tenantId: ID;
  businessId: ID;
  name: string;
  objective: 'sales' | 'traffic' | 'repeat_purchase' | 'awareness';
  productIds: ID[];
  channels: CampaignChannel[];
  status: CampaignStatus;
  budget?: Money;
  startsAt?: number;
  endsAt?: number;
  createdBy: ID;
  createdAt: number;
  approvedBy?: ID;
  approvedAt?: number;
}

export interface CreativeAsset {
  id: ID;
  businessId: ID;
  campaignId: ID;
  format: 'image' | 'video' | 'story' | 'copy';
  source: 'human' | 'ai' | 'hybrid';
  uri?: string;
  copy?: string;
  metadata?: Record<string, unknown>;
  approved: boolean;
  createdAt: number;
}

export interface AttributionEvent {
  id: ID;
  businessId: ID;
  campaignId: ID;
  orderId?: ID;
  saleId?: ID;
  event: 'impression' | 'click' | 'lead' | 'order' | 'sale';
  revenue?: Money;
  occurredAt: number;
}
