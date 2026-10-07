import webpush from 'web-push';
import env from '../config/env';
import * as pushRepository from '../repositories/pushRepository';

const configured = Boolean(env.vapid.publicKey && env.vapid.privateKey && env.vapid.subject);

if (configured) {
  webpush.setVapidDetails(env.vapid.subject as string, env.vapid.publicKey as string, env.vapid.privateKey as string);
} else {
  console.warn('[pushService] VAPID keys not configured — push notifications are disabled.');
}

export function getPublicKey(): string | null {
  return env.vapid.publicKey || null;
}

export function saveSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  return pushRepository.upsertSubscription({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth });
}

export function removeSubscription(endpoint: string) {
  return pushRepository.deleteByEndpoint(endpoint);
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  badge?: number;
}

// Side-channel alert like email — a push failure must never break order processing.
// A 404/410 response means that browser install unsubscribed or expired, so its row
// is pruned rather than retried forever.
export async function sendToAll(payload: PushPayload): Promise<void> {
  if (!configured) return;

  const subscriptions = await pushRepository.listAll();
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pushRepository.deleteByEndpoint(sub.endpoint);
        } else {
          console.error('[pushService] failed to send to one subscription:', err.message);
        }
      }
    }),
  );
}
