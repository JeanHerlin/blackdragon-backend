import emailProvider from '../providers/email';
import { ADMIN_NOTIFICATION_EMAIL } from '../config/constants';

interface NotifiableOrder {
  id: string;
  targetUid?: string | null;
  delivery?: { lastError?: string | null } | null;
}

type NotificationEvent = 'delivery_failed' | 'manual_delivery_pending' | 'credentials_received';

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
};

export async function notify(event: NotificationEvent, order: NotifiableOrder): Promise<void> {
  const template = TEMPLATES[event];
  if (!template) throw new Error(`Unknown notification event: ${event}`);

  const { subject, htmlContent } = template(order);
  await emailProvider.sendEmail({ to: ADMIN_NOTIFICATION_EMAIL, subject, htmlContent });
}
