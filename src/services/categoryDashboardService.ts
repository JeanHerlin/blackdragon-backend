import * as catalogService from './catalogService';
import * as settingsService from './settingsService';
import * as orderRepository from '../repositories/orderRepository';

function dayRange(dateStr?: string) {
  const start = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

interface CustomerOrder {
  customerRef: string;
  amount: number;
  createdAt: Date;
}

interface CustomerSummary {
  customerRef: string;
  ordersCount: number;
  totalSpent: number;
  lastPurchaseAt: Date;
}

// Grouping raw order rows by customerRef in JS rather than a DB-level groupBy: the
// aggregates needed (count, total, last purchase date) are cheap at this data volume
// and simpler to express here than in a groupBy + separate max() query.
function summarizeCustomers(orders: CustomerOrder[]): CustomerSummary[] {
  const byCustomer = new Map<string, CustomerSummary>();

  for (const order of orders) {
    const existing = byCustomer.get(order.customerRef) || {
      customerRef: order.customerRef,
      ordersCount: 0,
      totalSpent: 0,
      lastPurchaseAt: order.createdAt,
    };
    existing.ordersCount += 1;
    existing.totalSpent += order.amount;
    if (order.createdAt > existing.lastPurchaseAt) existing.lastPurchaseAt = order.createdAt;
    byCustomer.set(order.customerRef, existing);
  }

  return [...byCustomer.values()].sort((a, b) => b.totalSpent - a.totalSpent);
}

export async function getCategoryDashboard(categoryCode: string, dateStr?: string) {
  const category = await catalogService.getCategoryByCode(categoryCode);
  const { start, end } = dayRange(dateStr);

  const [settings, daySummary, pendingCount, deliveryFailedCount, soldCounts, pendingOrders, customerOrders] = await Promise.all([
    settingsService.getSettings(),
    orderRepository.getCategoryDaySummary(category.id, start, end),
    orderRepository.countPendingForCategory(category.id),
    orderRepository.countDeliveryFailedForCategory(category.id),
    orderRepository.getSoldCountsByProduct(category.id, start, end),
    orderRepository.listPendingOrdersForCategory(category.id),
    orderRepository.listCustomersForCategory(category.id),
  ]);

  return {
    category: { id: category.id, code: category.code, label: category.label, game: category.game },
    usdToArRate: settings.usdToArRate,
    stats: {
      salesCount: daySummary.salesCount,
      revenue: daySummary.revenue,
      pendingCount,
      deliveryFailedCount,
    },
    products: category.products.map((product) => ({
      ...product,
      soldCount: soldCounts[product.id] || 0,
    })),
    pendingOrders,
    customers: summarizeCustomers(customerOrders),
  };
}
