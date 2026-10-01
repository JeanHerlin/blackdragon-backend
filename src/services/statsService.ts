import * as orderRepository from '../repositories/orderRepository';

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getDashboardStats() {
  const [counts, deliveredToday] = await Promise.all([
    orderRepository.getStatusCounts(),
    orderRepository.countDeliveredSince(startOfToday()),
  ]);

  return {
    deliveryFailed: counts.delivery_failed || 0,
    manualPending: counts.manual_pending || 0,
    pendingPayment: counts.pending_payment || 0,
    deliveredToday,
  };
}
