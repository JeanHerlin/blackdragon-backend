import asyncHandler from '../utils/asyncHandler';
import * as credentialDeliveryService from '../services/credentialDeliveryService';

export const getContext = asyncHandler(async (req, res) => {
  res.json(await credentialDeliveryService.getDeliveryContext(req.params.token));
});

export const submit = asyncHandler(async (req, res) => {
  const { targetUid, login, password } = req.body;
  await credentialDeliveryService.submitCredentials(req.params.token, { targetUid, login, password });
  res.json({ message: 'Credentials received.' });
});
