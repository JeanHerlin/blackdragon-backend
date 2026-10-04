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
  message?: { text?: string; quick_reply?: { payload: string } };
  postback?: { payload: string };
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
      handleEvent(event.sender.id, event).catch((err) => {
        console.error(`[messenger] failed to handle event for ${event.sender.id}:`, err);
      });
    }
  }
}
