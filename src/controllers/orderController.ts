import asyncHandler from '../utils/asyncHandler';
import * as orderService from '../services/orderService';

export const createOrder = asyncHandler(async (req, res) => {
  const { productId, targetUid, customerRef, channel, promoCode } = req.body;
  const { order, paymentLink } = await orderService.createOrder({ productId, targetUid, customerRef, channel, promoCode });
  res.status(201).json({ orderId: order.id, status: order.status, paymentLink, discountAr: order.discountAr });
});

export const getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrder(req.params.id);
  res.json(order);
});

export const getPaymentContext = asyncHandler(async (req, res) => {
  res.json(await orderService.getPaymentContext(req.params.reference));
});

export const confirmPayment = asyncHandler(async (req, res) => {
  const result = await orderService.confirmPayment(req.params.reference, req.body.outcome);
  res.json(result);
});
