import asyncHandler from '../utils/asyncHandler';
import * as orderService from '../services/orderService';
import * as credentialViewService from '../services/credentialViewService';

export const listOrders = asyncHandler(async (req, res) => {
  res.json(
    await orderService.listOrders({
      status: req.query.status as string | undefined,
      purchaseType: req.query.purchaseType as string | undefined,
      paymentProvider: req.query.paymentProvider as string | undefined,
    }),
  );
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

export const getCashpointProof = asyncHandler(async (req, res) => {
  res.json(await orderService.getCashpointProof(req.params.id));
});

export const rejectOrder = asyncHandler(async (req, res) => {
  res.json(await orderService.rejectOrder(req.params.id, req.body.note));
});

export const flagIssue = asyncHandler(async (req, res) => {
  res.json(await orderService.flagIssue(req.params.id, req.body.note));
});

export const resolveIssue = asyncHandler(async (req, res) => {
  res.json(await orderService.resolveIssue(req.params.id));
});

export const confirmCashpointPayment = asyncHandler(async (req, res) => {
  res.json(await orderService.confirmCashpointPayment(req.params.id));
});

export const rejectCashpointPayment = asyncHandler(async (req, res) => {
  res.json(await orderService.rejectCashpointPayment(req.params.id, req.body.reason));
});

export const launchG2bulkDelivery = asyncHandler(async (req, res) => {
  res.json(await orderService.launchG2bulkDelivery(req.params.id));
});
