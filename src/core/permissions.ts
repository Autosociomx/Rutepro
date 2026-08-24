import type { Membership } from './domain';

export type Permission =
  | 'business.read'
  | 'business.manage'
  | 'catalog.read'
  | 'catalog.manage'
  | 'customer.read'
  | 'customer.manage'
  | 'order.create'
  | 'order.read'
  | 'order.manage'
  | 'production.read'
  | 'production.manage'
  | 'payment.collect'
  | 'cash.close'
  | 'route.read'
  | 'route.start'
  | 'route.sell'
  | 'route.close'
  | 'credit.read'
  | 'credit.create'
  | 'credit.collect'
  | 'inventory.read'
  | 'inventory.adjust'
  | 'campaign.read'
  | 'campaign.manage'
  | 'campaign.publish'
  | 'audit.read';

const roleDefaults: Record<Membership['role'], Permission[]> = {
  owner: [
    'business.read','business.manage','catalog.read','catalog.manage','customer.read','customer.manage',
    'order.create','order.read','order.manage','production.read','production.manage','payment.collect','cash.close',
    'route.read','route.start','route.sell','route.close','credit.read','credit.create','credit.collect',
    'inventory.read','inventory.adjust','campaign.read','campaign.manage','campaign.publish','audit.read',
  ],
  manager: [
    'business.read','catalog.read','catalog.manage','customer.read','customer.manage','order.create','order.read',
    'order.manage','production.read','production.manage','payment.collect','cash.close','route.read','route.start',
    'route.sell','route.close','credit.read','credit.create','credit.collect','inventory.read','inventory.adjust',
    'campaign.read','campaign.manage','audit.read',
  ],
  cashier: ['business.read','catalog.read','customer.read','order.read','payment.collect','cash.close','credit.read','credit.collect'],
  waiter: ['business.read','catalog.read','customer.read','order.create','order.read'],
  kitchen: ['business.read','catalog.read','order.read','production.read','production.manage'],
  driver: ['business.read','catalog.read','customer.read','route.read','route.start','route.sell','route.close','credit.read','credit.create','credit.collect','inventory.read'],
  marketing: ['business.read','catalog.read','campaign.read','campaign.manage','campaign.publish'],
  accountant: ['business.read','payment.collect','cash.close','credit.read','credit.collect','inventory.read','audit.read'],
  support: ['business.read','catalog.read','customer.read','order.read','production.read','route.read','inventory.read','audit.read'],
};

export const effectivePermissions = (membership: Membership): Set<Permission> => {
  const explicit = membership.permissions.filter((p): p is Permission =>
    roleDefaults.owner.includes(p as Permission),
  );
  return new Set<Permission>([...roleDefaults[membership.role], ...explicit]);
};

export const can = (membership: Membership, permission: Permission): boolean =>
  membership.active && effectivePermissions(membership).has(permission);
