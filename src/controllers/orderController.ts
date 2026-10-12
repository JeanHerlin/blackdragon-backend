import asyncHandler from '../utils/asyncHandler';
import * as orderService from '../services/orderService';

export const createOrder = asyncHandler(async (req, res) => {
  const { productId, targetUid, customerRef, channel, promoCode, paymentMethod } = req.body;
  const result = await orderService.createOrder({ productId, targetUid, customerRef, channel, promoCode, paymentMethod });
  res.status(201).json({
    orderId: result.order.id,
    status: result.order.status,
    discountAr: result.order.discountAr,
    paymentLink: result.paymentMethod === 'papi' ? result.paymentLink : undefined,
    proofSubmitLink: result.paymentMethod === 'cashpoint' ? result.proofSubmitLink : undefined,
  });
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
