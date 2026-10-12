// Channel-agnostic hook for messaging a customer back about their own order. Core
// services (orderService) call notifyCustomer() without knowing or caring which
// channel the order came from; the concrete sender is registered by that channel's
// adapter at startup (see adapters/messenger/messengerRoutes.ts), so core never
// imports an adapter directly — see code-standards skill's adapter-pattern rule.
interface Link {
  title: string;
  url: string;
}

type Sender = (psid: string, text: string, link?: Link) => Promise<void>;

let sender: Sender | null = null;

export function registerSender(fn: Sender): void {
  sender = fn;
}

// Silently does nothing when there's no PSID (order wasn't placed through a
// conversational channel) or no sender registered yet — this is always a side-channel
// courtesy message, never allowed to break the admin action that triggered it.
export async function notifyCustomer(messengerPsid: string | null | undefined, text: string, link?: Link): Promise<void> {
  if (!messengerPsid || !sender) return;
  try {
    await sender(messengerPsid, text, link);
  } catch (err: any) {
    console.error('[customerNotificationService] failed to notify customer:', err.message);
  }
}
