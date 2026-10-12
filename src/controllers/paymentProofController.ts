import asyncHandler from '../utils/asyncHandler';
import * as paymentProofService from '../services/paymentProofService';

export const getContext = asyncHandler(async (req, res) => {
  res.json(await paymentProofService.getProofContext(req.params.token));
});

export const submit = asyncHandler(async (req, res) => {
  const { senderPhone, reference, proofImageUrl } = req.body;
  const { deliverLink } = await paymentProofService.submitProof(req.params.token, { senderPhone, reference, proofImageUrl });
  res.json({ message: 'Proof received.', deliverLink });
});
