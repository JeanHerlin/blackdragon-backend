import express from 'express';
import * as webhookController from './webhookController';
import * as messengerClient from './messengerClient';
import * as customerNotificationService from '../../services/customerNotificationService';

// Registered once, as soon as this module loads (routes/index.ts imports it at app
// startup) — core services can message a customer back without ever importing this
// adapter directly. A link turns into a native Messenger button, same as the ones sent
// from within the conversation flow itself (see conversationFlow.ts).
customerNotificationService.registerSender((psid, text, link) =>
  link ? messengerClient.sendButtonTemplate(psid, text, link.title, link.url) : messengerClient.sendText(psid, text),
);

const router = express.Router();

// Unauthenticated by design — Facebook calls these directly. Integrity comes from the
// verify-token handshake (GET) and the signature check on every payload (POST), not a JWT.
router.get('/', webhookController.verify);
router.post('/', webhookController.receive);

export default router;
