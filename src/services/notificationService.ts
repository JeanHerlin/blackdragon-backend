import emailProvider from '../providers/email';
import * as pushService from './pushService';
import * as orderRepository from '../repositories/orderRepository';
import { ADMIN_NOTIFICATION_EMAIL } from '../config/constants';

interface NotifiableOrder {
  id: string;
  targetUid?: string | null;
  purchaseType?: string;
  delivery?: { lastError?: string | null } | null;
}

type NotificationEvent = 'delivery_failed' | 'manual_delivery_pending' | 'credentials_received' | 'cashpoint_proof_submitted';

function ordersUrl(order: NotifiableOrder): string {
  return order.purchaseType === 'compte' ? '/admin/orders/compte' : '/admin/orders/uid';
}

// Stand-in for the Telegram bot described in the architecture doc: same generic
// notify(event, data) shape, so swapping the transport later doesn't touch call sites.
const TEMPLATES: Record<NotificationEvent, (order: NotifiableOrder) => { subject: string; htmlContent: string }> = {
  delivery_failed: (order) => ({
    subject: `Black Dragon FF — Livraison échouée (commande #${order.id.slice(0, 8)})`,
    htmlContent: `<p>La livraison automatique a échoué pour la commande <b>${order.id}</b> (UID: ${order.targetUid}).</p><p>Erreur: ${order.delivery?.lastError || 'inconnue'}</p>`,
  }),
  manual_delivery_pending: (order) => ({
    subject: `Black Dragon FF — Nouvelle commande "achat par compte" en attente`,
    htmlContent: `<p>La commande <b>${order.id}</b> attend les identifiants du client.</p>`,
  }),
  credentials_received: (order) => ({
    subject: `Black Dragon FF — Accès reçus pour la commande #${order.id.slice(0, 8)}`,
    htmlContent: `<p>Les identifiants ont été reçus pour la commande <b>${order.id}</b>, prêts à être traités.</p>`,
  }),
  cashpoint_proof_submitted: (order) => ({
    subject: `Black Dragon FF — Preuve de paiement Cashpoint à valider (commande #${order.id.slice(0, 8)})`,
    htmlContent: `<p>Le client a soumis une preuve de dépôt Cashpoint pour la commande <b>${order.id}</b> — vérifie-la dans le backoffice avant de valider.</p>`,
  }),
};

// Same events, shorter copy and a deep link instead of HTML — the push notification is
// meant to get the admin to the right page in one tap, not to carry the full detail.
const PUSH_TEMPLATES: Record<NotificationEvent, (order: NotifiableOrder) => { title: string; body: string; url: string }> = {
  delivery_failed: (order) => ({
    title: 'Livraison UID échouée',
    body: `Commande #${order.id.slice(0, 8)} — la livraison g2bulk a échoué (UID: ${order.targetUid}).`,
    url: '/admin/orders/uid',
  }),
  manual_delivery_pending: (order) => ({
    title: 'Nouvelle commande par compte',
    body: `Commande #${order.id.slice(0, 8)} attend les identifiants du client.`,
    url: '/admin/orders/compte',
  }),
  credentials_received: (order) => ({
    title: 'Identifiants reçus',
    body: `Commande #${order.id.slice(0, 8)} prête à être traitée.`,
    url: '/admin/orders/compte',
  }),
  cashpoint_proof_submitted: (order) => ({
    title: 'Preuve Cashpoint à valider',
    body: `Commande #${order.id.slice(0, 8)} — preuve de dépôt soumise par le client.`,
    url: ordersUrl(order),
  }),
};

// The push payload carries the fresh total so the service worker can set the app badge
// the moment the push arrives — even with the backoffice fully closed, no open tab's
// polling hook required. See frontend's sw.js "push" handler and useAdminStatus (which
// keeps the badge in sync while a tab IS open, e.g. after the admin resolves an order).
async function currentBadgeCount(): Promise<number> {
  const [pendingCompteAttention, uidDeliveryFailed, uidCashpointPending] = await Promise.all([
    orderRepository.countNeedsAttention('compte'),
    orderRepository.countUidDeliveryFailed(),
    orderRepository.countUidCashpointProofPending(),
  ]);
  return pendingCompteAttention + uidDeliveryFailed + uidCashpointPending;
}

// Every event always gets an in-app notification (push + badge) — but only a genuine
// problem (g2bulk delivery actually failing) is worth an email. The other three are
// routine, expected steps of the normal pipeline (new compte order, credentials handed
// over, a cashpoint proof waiting on review) — the admin already sees those live in the
// backoffice badge, and the client has many customers, so one email per routine event
// would flood their inbox fast.
const EMAIL_EVENTS: ReadonlySet<NotificationEvent> = new Set(['delivery_failed']);

export async function notify(event: NotificationEvent, order: NotifiableOrder): Promise<void> {
  const { title, body, url } = PUSH_TEMPLATES[event](order);
  const badge = await currentBadgeCount();

  // Side-channel alerts, not the critical path — a failure here must never break
  // order/payment/delivery processing, which has already succeeded by this point.
  const tasks: Promise<unknown>[] = [
    pushService.sendToAll({ title, body, url, tag: event, badge }).catch((err: any) => {
      console.error(`[notificationService] failed to send "${event}" push:`, err.message);
    }),
  ];

  if (EMAIL_EVENTS.has(event)) {
    const { subject, htmlContent } = TEMPLATES[event](order);
    tasks.push(
      emailProvider.sendEmail({ to: ADMIN_NOTIFICATION_EMAIL, subject, htmlContent }).catch((err: any) => {
        console.error(`[notificationService] failed to send "${event}" email:`, err.message);
      }),
    );
  }

  await Promise.all(tasks);
}
