import crypto from 'crypto';
import type { Request, Response } from 'express';
import env from '../../config/env';
import { handleEvent } from './conversationFlow';
import * as messengerClient from './messengerClient';

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

// Facebook tolerates several seconds before it considers this a timeout and retries —
// plenty of room to actually await processing. We used to ack with 200 immediately and
// process in the background unawaited, which works on a long-running Node process but
// not on a serverless host (Vercel): the function can be frozen/torn down the instant
// the response is sent, silently killing any work still in flight — the bot would
// receive the message (logged, 200 returned) but never actually send its reply.
// Awaiting here before responding is the only way that's reliable on every host.
export async function receive(req: Request, res: Response): Promise<void> {
  if (!isValidSignature(req)) {
    res.sendStatus(403);
    return;
  }

  const entries = (req.body?.entry || []) as { messaging?: MessagingEntry[] }[];
  const tasks: Promise<void>[] = [];

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

      tasks.push(
        messengerClient
          .sendTypingOn(event.sender.id)
          .catch(() => {})
          .then(() => handleEvent(event.sender.id, event))
          .catch((err) => {
            console.error(`[messenger] failed to handle event for ${event.sender.id}:`, err);
          }),
      );
    }
  }

  await Promise.all(tasks);
  res.sendStatus(200);
}
