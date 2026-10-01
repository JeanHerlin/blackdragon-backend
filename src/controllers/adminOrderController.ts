import asyncHandler from '../utils/asyncHandler';
import * as orderService from '../services/orderService';
import * as credentialViewService from '../services/credentialViewService';

export const listOrders = asyncHandler(async (req, res) => {
  res.json(await orderService.listOrders(req.query.status as string | undefined));
});

export const getOrder = asyncHandler(async (req, res) => {
  res.json(await orderService.getOrder(req.params.id));
});

export const retryDelivery = asyncHandler(async (req, res) => {
  res.json(await orderService.retryDelivery(req.params.id));
});

export const markManualDelivered = asyncHandler(async (req, res) => {
  res.json(await orderService.markManualDelivered(req.params.id));
});

export const getCredentials = asyncHandler(async (req, res) => {
  res.json(await credentialViewService.revealCredentials(req.params.id));
});
