import * as catalogService from '../../services/catalogService';
import * as orderService from '../../services/orderService';
import * as conversationRepository from '../../repositories/conversationRepository';
import * as messengerClient from './messengerClient';

// Single active game today — see code-standards skill ("catalog is data, not code").
// A game-choice step can be added in front of this once a second game exists.
const GAME_CODE = 'free_fire';

interface ConversationData {
  [key: string]: unknown;
  displayName?: string;
  categoryCode?: string;
  productType?: string;
  productId?: string;
}

interface MessengerEvent {
  message?: { text?: string; quick_reply?: { payload: string } };
  postback?: { payload: string };
}

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  recharge: 'Recharge',
  abonnement: 'Abonnement',
  levelup: 'Level Up',
  largage: 'Largage',
};

function productTypeLabel(type: string): string {
  return PRODUCT_TYPE_LABELS[type] || type;
}

function formatAr(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR').replace(/,/g, '.')} Ar`;
}

function stockSuffix(p: { stockMode: string; stockQty: number }): string {
  return p.stockMode === 'limited' && p.stockQty <= 0 ? ' — Rupture de stock' : '';
}

// The whole flow is deliberately a thin translation layer: Messenger input/output in,
// core catalog/order services out — no business rule lives in this file (see
// code-standards skill's adapter-pattern rule).
export async function handleEvent(psid: string, event: MessengerEvent): Promise<void> {
  const state = await conversationRepository.getOrCreate(psid);
  let data = (state.data as ConversationData) || {};

  if (!data.displayName) {
    data = { ...data, displayName: await messengerClient.getUserDisplayName(psid) };
  }

  const text = event.message?.text;
  const payload = event.postback?.payload || event.message?.quick_reply?.payload;

  if (payload === 'CATEGORY' || text?.toLowerCase().trim() === 'menu') {
    await startFlow(psid, data);
    return;
  }

  if (payload?.startsWith('CATEGORY:')) {
    await handleCategoryChoice(psid, data, payload.slice('CATEGORY:'.length));
    return;
  }

  if (payload?.startsWith('TYPE:')) {
    await handleTypeChoice(psid, data, payload.slice('TYPE:'.length));
    return;
  }

  if (payload?.startsWith('PRODUCT:')) {
    await handleProductChoice(psid, data, payload.slice('PRODUCT:'.length));
    return;
  }

  if (state.step === 'awaiting_uid' && text) {
    await handleUidSubmission(psid, data, text.trim());
    return;
  }

  // First contact, the "Get Started" button, or any unrecognized input — restart clean.
  await startFlow(psid, data);
}

async function startFlow(psid: string, data: ConversationData): Promise<void> {
  const categories = await catalogService.listCategories(GAME_CODE);
  await conversationRepository.updateState(psid, 'awaiting_category', data);
  await messengerClient.sendQuickReplies(
    psid,
    'Bienvenue chez Black Dragon FF ! Comment veux-tu acheter tes diamants ?',
    categories.map((c) => ({ title: c.label, payload: `CATEGORY:${c.code}` })),
  );
}

async function handleCategoryChoice(psid: string, data: ConversationData, categoryCode: string): Promise<void> {
  const types = await catalogService.listProductTypes({ gameCode: GAME_CODE, categoryCode });

  if (types.length === 0) {
    await messengerClient.sendText(psid, "Aucun produit n'est disponible dans cette catégorie pour le moment — réessaie plus tard.");
    await startFlow(psid, data);
    return;
  }

  const next = { ...data, categoryCode };
  await conversationRepository.updateState(psid, 'awaiting_type', next);
  await messengerClient.sendQuickReplies(
    psid,
    'Quel type de produit veux-tu ?',
    types.map((t) => ({ title: productTypeLabel(t), payload: `TYPE:${t}` })),
  );
}

async function handleTypeChoice(psid: string, data: ConversationData, productType: string): Promise<void> {
  if (!data.categoryCode) {
    await startFlow(psid, data);
    return;
  }

  const products = await catalogService.listProducts({ gameCode: GAME_CODE, categoryCode: data.categoryCode, productType });

  if (products.length === 0) {
    await messengerClient.sendText(psid, 'Aucun produit disponible pour ce choix pour le moment.');
    await startFlow(psid, data);
    return;
  }

  const next = { ...data, productType };
  await conversationRepository.updateState(psid, 'awaiting_product', next);
  await messengerClient.sendGenericTemplate(
    psid,
    products.map((p) => ({
      title: p.label,
      subtitle: `${formatAr(p.salePrice)}${stockSuffix(p)}`,
      imageUrl: p.imageUrl || p.game.imageUrl,
      buttons: [{ title: 'Choisir', payload: `PRODUCT:${p.id}` }],
    })),
  );
}

async function handleProductChoice(psid: string, data: ConversationData, productId: string): Promise<void> {
  const next = { ...data, productId };
  await conversationRepository.updateState(psid, 'awaiting_uid', next);
  await messengerClient.sendText(psid, 'Parfait ! Donne-moi ton UID Free Fire pour continuer.');
}

async function handleUidSubmission(psid: string, data: ConversationData, targetUid: string): Promise<void> {
  if (!data.productId) {
    await startFlow(psid, data);
    return;
  }

  try {
    const { paymentLink } = await orderService.createOrder({
      productId: data.productId,
      targetUid,
      customerRef: `${data.displayName} (Messenger)`,
      channel: 'messenger',
    });
    await messengerClient.sendText(psid, `Commande créée ! Finalise ton paiement ici :\n${paymentLink}`);
  } catch (err: any) {
    await messengerClient.sendText(psid, `Oups, une erreur est survenue : ${err.message}`);
  }

  await conversationRepository.resetState(psid);
}
