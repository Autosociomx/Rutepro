import type { Money } from './domain';

export const money = (amountCents: number, currency = 'MXN'): Money => {
  if (!Number.isInteger(amountCents)) {
    throw new Error('Money must be represented as integer cents');
  }
  return { amountCents, currency };
};

export const addMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) throw new Error('Currency mismatch');
  return money(a.amountCents + b.amountCents, a.currency);
};

export const subtractMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) throw new Error('Currency mismatch');
  return money(a.amountCents - b.amountCents, a.currency);
};

export const multiplyMoney = (a: Money, quantity: number): Money => {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error('Invalid quantity');
  return money(Math.round(a.amountCents * quantity), a.currency);
};

export const zeroMoney = (currency = 'MXN'): Money => money(0, currency);
