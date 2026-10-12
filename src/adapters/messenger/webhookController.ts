import crypto from 'crypto';
import type { Request, Response } from 'express';
import env from '../../config/env';
import { handleEvent } from './conversationFlow';

// One-time handshake Meta performs when you click "Verify and Save" on the webhook
// subscription — never called again afterward.
export function verify(req: Request, res: Response): void {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === env.messenger.verifyToken) {
    res.status(200).send(challenge);
    return;
  }
  res.sendStatus(403);
}

function isValidSignature(req: Request): boolean {
  const signature = req.get('X-Hub-Signature-256');
  if (!signature || !env.messenger.appSecret || !req.rawBody) return false;

  const expected = `sha256=${crypto.createHmac('sha256', env.messenger.appSecret).update(req.rawBody).digest('hex')}`;
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

interface MessagingEntry {
  sender: { id: string };
  message?: { text?: string; quick_reply?: { payload: string }; is_echo?: boolean };
  postback?: { payload: string };
  // Present (instead of message/postback) on delivery and read receipts — never
  // forwarded to the flow, see the filter below.
  delivery?: unknown;
  read?: unknown;
}

// Facebook requires a fast 200 and will retry (then eventually disable the webhook) on
// timeouts — acknowledge immediately, process after responding.
export function receive(req: Request, res: Response): void {
  if (!isValidSignature(req)) {
    res.sendStatus(403);
    return;
  }

  res.sendStatus(200);

  const entries = (req.body?.entry || []) as { messaging?: MessagingEntry[] }[];
  for (const entry of entries) {
    for (const event of entry.messaging || []) {
      // A single webhook call bundles more than just the user's message: delivery/read
      // receipts, and an echo of the bot's own reply (message.is_echo) once the Page
      // sends one. None of these carry real user input — forwarding them to the
      // conversation flow made it treat each as "unrecognized input" and restart the
      // flow, which is why the welcome message was repeating.
      if (event.message?.is_echo) {
        console.log(`[messenger webhook] skipped (echo of our own message) from ${event.sender.id}`);
        continue;
      }
      if (!event.message && !event.postback) {
        console.log(`[messenger webhook] skipped (delivery/read receipt, no real content) from ${event.sender.id}`);
        continue;
      }

      console.log(`[messenger webhook] <- ${event.sender.id}:`, JSON.stringify(event.postback || event.message));

      handleEvent(event.sender.id, event).catch((err) => {
        console.error(`[messenger] failed to handle event for ${event.sender.id}:`, err);
      });
    }
  }
}
