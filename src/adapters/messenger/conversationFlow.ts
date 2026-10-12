import * as catalogService from '../../services/catalogService';
import * as orderService from '../../services/orderService';
import * as promoCodeService from '../../services/promoCodeService';
import * as settingsService from '../../services/settingsService';
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
  targetUid?: string;
  verifiedPseudo?: string;
  verifiedRegion?: string;
  verifiedLevel?: string | number;
  promoCode?: string;
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

// Offered from the category step onward (restarting before anything was chosen would
// be a no-op) so the customer always has a visible way out instead of having to know
// to type "menu".
const RESTART_OPTION = { title: 'Recommencer', payload: 'RESTART' };

// Undoes just the current step instead of wiping the whole order — offered everywhere
// RESTART_OPTION is, except the very first step (nothing to go back to there either).
const BACK_OPTION = { title: '◀ Retour', payload: 'BACK' };

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
  const normalizedText = text?.toLowerCase().trim();

  console.log(`[conversationFlow] ${psid} step=${state.step} payload=${payload ?? '-'} text=${text ?? '-'}`);

  if (payload === 'CATEGORY' || payload === 'RESTART' || normalizedText === 'menu') {
    await startFlow(psid, data);
    return;
  }

  // Global commands — recognized from anywhere, mid-purchase included, same as "menu"
  // above. A customer confused mid-flow who types "aide" should get help, not a
  // confusing "UID not found" error from whichever step happens to be waiting on text.
  if (payload === 'ORDER_STATUS' || normalizedText === 'suivi' || normalizedText === 'ma commande') {
    await showOrderStatus(psid, data);
    return;
  }

  if (payload === 'ORDER_HISTORY' || normalizedText === 'mes commandes' || normalizedText === 'historique') {
    await showOrderHistory(psid, data);
    return;
  }

  if (payload === 'HELP' || normalizedText === 'aide' || normalizedText === 'help') {
    await showHelp(psid, data);
    return;
  }

  if (payload === 'BACK' || normalizedText === 'retour') {
    await handleBack(psid, data, state.step);
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

  if (payload?.startsWith('PAYMENT:')) {
    await handlePaymentMethodChoice(psid, data, payload.slice('PAYMENT:'.length) as 'papi' | 'cashpoint');
    return;
  }

  if (payload?.startsWith('UID_CONFIRM:')) {
    await handleUidConfirmation(psid, data, payload.slice('UID_CONFIRM:'.length) as 'yes' | 'no');
    return;
  }

  if (payload === 'PROMO:skip') {
    await askPaymentMethod(psid, data);
    return;
  }

  if (state.step === 'awaiting_uid' && text) {
    await handleUidSubmission(psid, data, text.trim());
    return;
  }

  if (state.step === 'awaiting_promo_code' && text) {
    await handlePromoCodeSubmission(psid, data, text.trim());
    return;
  }

  // First contact, the "Get Started" button, or any unrecognized input — restart clean.
  await startFlow(psid, data);
}

async function startFlow(psid: string, data: ConversationData): Promise<void> {
  console.log(`[conversationFlow] ${psid} -> startFlow`);
  const categories = await catalogService.listCategories(GAME_CODE);
  // displayName/targetUid etc. from a previous, now-abandoned attempt are intentionally
  // dropped here — a fresh "Bienvenue" means a fresh order, not a resumed one.
  await conversationRepository.updateState(psid, 'awaiting_category', { displayName: data.displayName });
  await messengerClient.sendQuickReplies(
    psid,
    'Bienvenue chez Black Dragon FF ! Comment veux-tu acheter tes diamants ?',
    [
      ...categories.map((c) => ({ title: c.label, payload: `CATEGORY:${c.code}` })),
      { title: '📦 Suivre ma commande', payload: 'ORDER_STATUS' },
      { title: '🕓 Mes commandes', payload: 'ORDER_HISTORY' },
      { title: '❓ Aide', payload: 'HELP' },
    ],
  );
}

// The 3 lines customer-facing status summary — reused by both "suivi" (latest order
// only) and "mes commandes" (last few), see below.
function formatOrderLine(order: Awaited<ReturnType<typeof orderService.listCustomerOrders>>[number]): string {
  return `#${order.id.slice(0, 8)} — ${order.product.label} — ${formatAr(order.amount)} — ${orderService.customerStatusLabel(order.status)}`;
}

async function showOrderStatus(psid: string, data: ConversationData): Promise<void> {
  console.log(`[conversationFlow] ${psid} -> showOrderStatus`);
  const [latest] = await orderService.listCustomerOrders(psid, 1);
  if (!latest) {
    await messengerClient.sendQuickReplies(psid, "Tu n'as pas encore de commande chez nous.", [
      { title: 'Acheter des diamants', payload: 'CATEGORY' },
    ]);
    return;
  }
  await messengerClient.sendQuickReplies(psid, `Ta dernière commande :\n${formatOrderLine(latest)}`, [RESTART_OPTION]);
}

async function showOrderHistory(psid: string, data: ConversationData): Promise<void> {
  console.log(`[conversationFlow] ${psid} -> showOrderHistory`);
  const orders = await orderService.listCustomerOrders(psid, 5);
  if (orders.length === 0) {
    await messengerClient.sendQuickReplies(psid, "Tu n'as pas encore de commande chez nous.", [
      { title: 'Acheter des diamants', payload: 'CATEGORY' },
    ]);
    return;
  }
  const label = orders.length > 1 ? `Tes ${orders.length} dernières commandes :` : 'Ta dernière commande :';
  await messengerClient.sendQuickReplies(psid, `${label}\n${orders.map(formatOrderLine).join('\n')}`, [RESTART_OPTION]);
}

async function showHelp(psid: string, data: ConversationData): Promise<void> {
  console.log(`[conversationFlow] ${psid} -> showHelp`);
  const lines = [
    'Comment ça marche :',
    '1. Choisis Achat par ID (UID) ou Achat par compte.',
    '2. Choisis ton produit.',
    '3. Paie par Papi (en ligne) ou par dépôt Cashpoint.',
    "Un problème avec une commande ? Décris-le ici, un admin te répond directement dans cette conversation.",
  ];
  await messengerClient.sendQuickReplies(psid, lines.join('\n'), [
    { title: 'Acheter des diamants', payload: 'CATEGORY' },
    { title: '📦 Suivre ma commande', payload: 'ORDER_STATUS' },
  ]);
}

async function handleCategoryChoice(psid: string, data: ConversationData, categoryCode: string): Promise<void> {
  console.log(`[conversationFlow] ${psid} -> handleCategoryChoice categoryCode=${categoryCode}`);
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
    [...types.map((t) => ({ title: productTypeLabel(t), payload: `TYPE:${t}` })), BACK_OPTION, RESTART_OPTION],
  );
}

async function handleTypeChoice(psid: string, data: ConversationData, productType: string): Promise<void> {
  console.log(`[conversationFlow] ${psid} -> handleTypeChoice productType=${productType}`);
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
    [BACK_OPTION, RESTART_OPTION],
  );
}

async function handleProductChoice(psid: string, data: ConversationData, productId: string): Promise<void> {
  console.log(`[conversationFlow] ${psid} -> handleProductChoice productId=${productId}`);
  const next = { ...data, productId };

  // Both "uid" and "compte" collect + verify the UID now. For "uid" it's the actual
  // delivery target; for "compte" it's never used for delivery (that happens by logging
  // into the account handed over later via the credentials form) — it's stored purely as
  // a cross-check the admin can compare against what they see once inside the account.
  await conversationRepository.updateState(psid, 'awaiting_uid', next);
  // A quick reply alongside a free-text prompt still lets the customer type their UID
  // normally — it only adds the escape hatch, it doesn't replace typing.
  await messengerClient.sendQuickReplies(psid, 'Parfait ! Donne-moi ton UID Free Fire pour continuer.', [BACK_OPTION, RESTART_OPTION]);
}

async function handleUidSubmission(psid: string, data: ConversationData, targetUid: string): Promise<void> {
  console.log(`[conversationFlow] ${psid} -> handleUidSubmission targetUid=${targetUid}`);
  if (!data.productId) {
    await startFlow(psid, data);
    return;
  }

  let verification;
  try {
    verification = await orderService.verifyPlayer(targetUid);
  } catch (err: any) {
    console.error(`[conversationFlow] ${psid} verifyPlayer failed for uid=${targetUid}:`, err.message);
    // Stays in awaiting_uid either way (same as before — the customer can just retype),
    // but without an escape hatch here a wrong/mistyped UID trapped the customer with no
    // visible way out besides knowing to type "menu" or "retour" by heart.
    await messengerClient.sendQuickReplies(psid, 'UID introuvable chez Free Fire. Vérifie et renvoie-le.', [BACK_OPTION, RESTART_OPTION]);
    return;
  }

  const next: ConversationData = {
    ...data,
    targetUid,
    verifiedPseudo: verification.pseudo,
    verifiedRegion: verification.region,
    verifiedLevel: verification.level,
  };
  await conversationRepository.updateState(psid, 'awaiting_uid_confirmation', next);

  const lines = [`UID : ${targetUid}`, `Pseudo : ${verification.pseudo}`];
  if (verification.region) lines.push(`Région : ${verification.region}`);
  if (verification.level !== undefined && verification.level !== null) lines.push(`Niveau : ${verification.level}`);

  await messengerClient.sendQuickReplies(psid, `On a trouvé ce compte :\n${lines.join('\n')}\n\nC'est bien le tien ?`, [
    { title: 'Oui, c\'est ça', payload: 'UID_CONFIRM:yes' },
    { title: 'Non, recommencer', payload: 'UID_CONFIRM:no' },
  ]);
}

async function handleUidConfirmation(psid: string, data: ConversationData, answer: 'yes' | 'no'): Promise<void> {
  console.log(`[conversationFlow] ${psid} -> handleUidConfirmation answer=${answer}`);
  if (answer === 'no') {
    await conversationRepository.updateState(psid, 'awaiting_uid', data);
    await messengerClient.sendQuickReplies(psid, 'Pas de souci, redonne-moi ton UID Free Fire.', [RESTART_OPTION]);
    return;
  }

  if (!data.productId || !data.targetUid) {
    await startFlow(psid, data);
    return;
  }

  // Only worth asking if a code could actually apply here — no point prompting every
  // customer for a promo code when none is currently active for this product.
  const hasPromo = await promoCodeService.hasActivePromoForProduct(data.productId);
  if (hasPromo) {
    await askPromoCode(psid, data);
  } else {
    await askPaymentMethod(psid, data);
  }
}

async function askPromoCode(psid: string, data: ConversationData): Promise<void> {
  await conversationRepository.updateState(psid, 'awaiting_promo_code', data);
  await messengerClient.sendQuickReplies(psid, 'As-tu un code promo ? (facultatif — tape-le, ou ignore cette étape)', [
    { title: 'Non, continuer', payload: 'PROMO:skip' },
    BACK_OPTION,
    RESTART_OPTION,
  ]);
}

async function handlePromoCodeSubmission(psid: string, data: ConversationData, code: string): Promise<void> {
  console.log(`[conversationFlow] ${psid} -> handlePromoCodeSubmission code=${code}`);
  if (!data.productId) {
    await startFlow(psid, data);
    return;
  }

  try {
    const product = await catalogService.getProductOrThrow(data.productId);
    const { promoCodeUsed, discountAr } = await promoCodeService.resolveDiscount(code, data.productId, product.salePrice);
    await messengerClient.sendText(psid, `Code "${promoCodeUsed}" appliqué : -${formatAr(discountAr)}.`);
    await askPaymentMethod(psid, { ...data, promoCode: promoCodeUsed ?? undefined });
  } catch (err: any) {
    await messengerClient.sendQuickReplies(psid, `${err.message} Réessaie, ou ignore cette étape.`, [
      { title: 'Non, continuer', payload: 'PROMO:skip' },
      RESTART_OPTION,
    ]);
  }
}

// Shown right before the customer commits to either payment path (Papi or Cashpoint) —
// one recap covers both, since they fork from this same question. Re-fetched from the
// DB rather than cached on ConversationData so the price/label/discount are never stale
// if the admin changed them mid-conversation.
async function askPaymentMethod(psid: string, data: ConversationData): Promise<void> {
  await conversationRepository.updateState(psid, 'awaiting_payment_method', data);

  const recapLines = ['Récapitulatif de ta commande :'];
  let requiresAccountCredentials = false;
  if (data.productId) {
    const product = await catalogService.getProductOrThrow(data.productId);
    requiresAccountCredentials = product.category.requiresAccountCredentials;
    const { discountAr, finalAmount } = await promoCodeService.resolveDiscount(data.promoCode, data.productId, product.salePrice);
    recapLines.push(
      discountAr > 0
        ? `${product.label} — ${formatAr(product.salePrice)} (code ${data.promoCode} : -${formatAr(discountAr)}) = ${formatAr(finalAmount)}`
        : `${product.label} — ${formatAr(product.salePrice)}`,
    );
  }
  if (data.targetUid) {
    recapLines.push(`UID : ${data.targetUid}${data.verifiedPseudo ? ` (${data.verifiedPseudo})` : ''}`);
  }

  // Only "compte" orders are admin-driven after payment (manual login + delivery) — a
  // "uid" order's g2bulk delivery is automatic either way, so the admin's own
  // active/inactive toggle never affects it and isn't worth mentioning there.
  if (requiresAccountCredentials) {
    const settings = await settingsService.getSettings();
    if (!settings.isAdminActive) {
      recapLines.push("⚠️ L'équipe est temporairement indisponible — le traitement de ta commande pourrait prendre un peu plus de temps que d'habitude.");
    }
  }

  await messengerClient.sendQuickReplies(psid, `${recapLines.join('\n')}\n\nComment veux-tu payer ?`, [
    { title: 'Paiement en ligne (Papi)', payload: 'PAYMENT:papi' },
    { title: 'Dépôt Cashpoint', payload: 'PAYMENT:cashpoint' },
    BACK_OPTION,
    RESTART_OPTION,
  ]);
}

// Undoes one step at a time, replaying the prompt for the step just before the current
// one rather than wiping everything like RESTART does. The last three steps collapse
// onto re-asking the UID rather than trying to reconstruct every intermediate branch
// (promo asked or not, which payment sub-state) — one extra tap beats a back button
// that silently drops data or breaks on an edge case.
async function handleBack(psid: string, data: ConversationData, currentStep: string): Promise<void> {
  console.log(`[conversationFlow] ${psid} -> handleBack from step=${currentStep}`);
  switch (currentStep) {
    case 'awaiting_type':
      await startFlow(psid, data);
      return;
    case 'awaiting_product':
      if (!data.categoryCode) {
        await startFlow(psid, data);
        return;
      }
      await handleCategoryChoice(psid, data, data.categoryCode);
      return;
    case 'awaiting_uid':
      if (!data.categoryCode || !data.productType) {
        await startFlow(psid, data);
        return;
      }
      await handleTypeChoice(psid, { ...data, productId: undefined }, data.productType);
      return;
    case 'awaiting_uid_confirmation':
    case 'awaiting_promo_code':
    case 'awaiting_payment_method':
      await conversationRepository.updateState(psid, 'awaiting_uid', data);
      await messengerClient.sendQuickReplies(psid, 'Redonne-moi ton UID Free Fire.', [BACK_OPTION, RESTART_OPTION]);
      return;
    default:
      await startFlow(psid, data);
  }
}

async function handlePaymentMethodChoice(psid: string, data: ConversationData, paymentMethod: 'papi' | 'cashpoint'): Promise<void> {
  console.log(`[conversationFlow] ${psid} -> handlePaymentMethodChoice paymentMethod=${paymentMethod}`);
  if (!data.productId) {
    await startFlow(psid, data);
    return;
  }

  try {
    const result = await orderService.createOrder({
      productId: data.productId,
      targetUid: data.targetUid,
      customerRef: `${data.displayName} (Messenger)`,
      channel: 'messenger',
      promoCode: data.promoCode,
      paymentMethod,
      messengerPsid: psid,
    });

    console.log(`[conversationFlow] ${psid} order created orderId=${result.order.id} status=${result.order.status}`);

    if (result.paymentMethod === 'cashpoint') {
      await messengerClient.sendButtonTemplate(
        psid,
        'Commande créée ! Fais ton dépôt Cashpoint, puis envoie la preuve via ce lien.',
        'Envoyer ma preuve',
        result.proofSubmitLink,
      );
    } else {
      await messengerClient.sendButtonTemplate(psid, 'Commande créée ! Finalise ton paiement en ligne.', 'Payer maintenant', result.paymentLink);
    }
  } catch (err: any) {
    console.error(`[conversationFlow] ${psid} order creation failed:`, err.message);
    // The state resets to 'start' right after regardless, but that alone only helps on
    // the customer's *next* message — a plain error with no button here left the same
    // kind of dead end as the UID-not-found case, just one step later in the flow.
    await messengerClient.sendQuickReplies(psid, `Oups, une erreur est survenue : ${err.message}`, [RESTART_OPTION]);
  }

  await conversationRepository.resetState(psid);
}
