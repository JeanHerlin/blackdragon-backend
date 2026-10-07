import * as orderRepository from '../repositories/orderRepository';

type Range = 'today' | '7d' | 'month';

function rangeStart(range: Range): Date {
  const now = new Date();
  if (range === '7d') {
    const date = new Date(now);
    date.setDate(date.getDate() - 7);
    return date;
  }
  if (range === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getDashboardStats(range: Range = 'today') {
  const dateFrom = rangeStart(range);

  const [delivered, totalOrders, split, uidOutcomes, topProductsRaw, uidDeliveryFailed, compteNeedsAttention, dailySeriesRaw] =
    await Promise.all([
      orderRepository.getDeliveredSummarySince(dateFrom),
      orderRepository.countOrdersSince(dateFrom),
      orderRepository.getDeliveredSplitByPurchaseType(dateFrom),
      orderRepository.getUidDeliveryOutcomesSince(dateFrom),
      orderRepository.getTopProductsSoldSince(dateFrom, 5),
      // Current outstanding issues, not range-scoped — an alert about a UID delivery
      // that's been broken for days shouldn't disappear just because "today" was picked.
      orderRepository.countUidDeliveryFailed(),
      orderRepository.countNeedsAttention('compte'),
      range === 'today' ? Promise.resolve(null) : orderRepository.getDailyRevenueSince(dateFrom),
    ]);

  const uidAttempted = (uidOutcomes.delivered || 0) + (uidOutcomes.delivery_failed || 0);
  const uidSuccessRate = uidAttempted > 0 ? Math.round(((uidOutcomes.delivered || 0) / uidAttempted) * 1000) / 10 : null;

  const topProducts = topProductsRaw.map(({ product, qty, revenue }) => ({
    productId: product.id,
    label: product.label,
    externalRef: product.externalRef,
    purchaseType: product.category.requiresAccountCredentials ? 'compte' : 'uid',
    qty,
    revenue,
    share: delivered.revenue > 0 ? Math.round((revenue / delivered.revenue) * 1000) / 10 : 0,
  }));

  return {
    range,
    revenue: delivered.revenue,
    totalOrders,
    avgBasket: Math.round(delivered.avgBasket),
    uidSuccessRate,
    modeSplit: { uid: split.uid || 0, compte: split.compte || 0 },
    alerts: { uidDeliveryFailed, compteNeedsAttention },
    topProducts,
    dailySeries: dailySeriesRaw
      ? dailySeriesRaw.map((row) => ({ date: row.day.toISOString().slice(0, 10), revenue: row.revenue }))
      : null,
  };
}
