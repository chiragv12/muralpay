import { Decimal } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';

export function formatUsd(amount: Prisma.Decimal | string | number): string {
  return new Decimal(amount.toString()).toDecimalPlaces(2).toFixed(2);
}
