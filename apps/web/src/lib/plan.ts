// The signed-in customer's subscription (sample).

import { dailyVolume } from "@/lib/data";
import { bidTiers, orderTiers } from "@stratosopx/core/pricing";

export const DAYS_IN_MONTH = 31;

export const plan = {
  order: orderTiers.find((t) => t.id === "growth")!,
  bid: bidTiers.find((t) => t.id === "pro")!,
  bidIncluded: 15,
  bidOverage: 95,
  bidsUsed: 11,
  // Billable orders so far this month. Rejected and duplicate documents are excluded.
  ordersUsed: dailyVolume.reduce((a, b) => a + b, 0),
  daysElapsed: dailyVolume.length,
};

export function orderUsage() {
  const { order, ordersUsed, daysElapsed } = plan;
  const projected = Math.round((ordersUsed / daysElapsed) * DAYS_IN_MONTH);
  const projectedOverage = Math.max(0, projected - order.included);
  return {
    used: ordersUsed,
    included: order.included,
    share: ordersUsed / order.included,
    projected,
    projectedOverage,
    projectedOverageCost: projectedOverage * order.overage,
  };
}
