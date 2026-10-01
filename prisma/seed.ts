import { PrismaClient, SupplierCatalogEntry } from '@prisma/client';
const prisma = new PrismaClient();

const REGION = 'middle_east';

interface SupplierEntrySeed {
  supplierRef: string;
  name: string;
  basePriceUsd: number;
  productType: string;
}

interface ProductSeed {
  label: string;
  externalRef: string;
  basePriceUsd: number;
  salePrice: number;
  productType: string;
  catalogRef?: string;
}

async function main() {
  // Verified against g2bulk's public /v1/games endpoint (freefire_me entry) — the only
  // image g2bulk publishes for this game, used as the default product card image.
  const gameImageUrl = 'https://api.g2bulk.com/images/freefire_me.png';
  const game = await prisma.game.upsert({
    where: { code: 'free_fire' },
    update: { imageUrl: gameImageUrl },
    create: { code: 'free_fire', label: 'Free Fire', isActive: true, imageUrl: gameImageUrl },
  });

  const uidCategory = await prisma.category.upsert({
    where: { gameId_code: { gameId: game.id, code: 'uid' } },
    update: {},
    create: { gameId: game.id, code: 'uid', label: 'Achat par ID (UID)', requiresAccountCredentials: false },
  });

  const compteCategory = await prisma.category.upsert({
    where: { gameId_code: { gameId: game.id, code: 'compte' } },
    update: {},
    create: { gameId: game.id, code: 'compte', label: 'Achat par compte', requiresAccountCredentials: true },
  });

  // The only 5 entries actually confirmed against g2bulk's public "Middle East" catalogue
  // (GET /v1/games/freefire_me/catalogue — no auth required). Everything the admin adds
  // from now on must come from a table like this one, never typed freehand, so externalRef
  // always matches a real supplier reference and delivery can't fail on a bad id.
  const supplierEntries: SupplierEntrySeed[] = [
    { supplierRef: '847', name: '110', basePriceUsd: 0.95, productType: 'recharge' },
    { supplierRef: '848', name: '231', basePriceUsd: 1.9, productType: 'recharge' },
    { supplierRef: '849', name: '583', basePriceUsd: 4.75, productType: 'recharge' },
    { supplierRef: '850', name: '1188', basePriceUsd: 9.5, productType: 'recharge' },
    { supplierRef: '851', name: '2420', basePriceUsd: 19.0, productType: 'recharge' },
  ];

  const catalogEntryByRef: Record<string, SupplierCatalogEntry> = {};
  for (const entry of supplierEntries) {
    const saved = await prisma.supplierCatalogEntry.upsert({
      where: { supplier_region_supplierRef: { supplier: 'g2bulk', region: REGION, supplierRef: entry.supplierRef } },
      update: { name: entry.name, basePriceUsd: entry.basePriceUsd, productType: entry.productType },
      create: { gameId: game.id, supplier: 'g2bulk', region: REGION, ...entry },
    });
    catalogEntryByRef[entry.supplierRef] = saved;
  }

  // Real UID sale prices as given by the client. Only the 5 rows tagged with a
  // catalogRef below are backed by a confirmed real g2bulk id (see supplierEntries
  // above) — the rest are interpolated/extrapolated from that region's per-diamond
  // rate curve and still need verifying against a real reseller account.
  const uidProducts: ProductSeed[] = [
    { label: '100+10💎', externalRef: 'ff-uid-110', basePriceUsd: 0.95, salePrice: 4800, productType: 'recharge', catalogRef: '847' },
    { label: '210+21💎', externalRef: 'ff-uid-231', basePriceUsd: 1.9, salePrice: 9600, productType: 'recharge', catalogRef: '848' },
    { label: '310+31💎', externalRef: 'ff-uid-341', basePriceUsd: 2.8, salePrice: 14500, productType: 'recharge' },
    { label: '420+42💎', externalRef: 'ff-uid-462', basePriceUsd: 3.78, salePrice: 19500, productType: 'recharge' },
    { label: '530+53💎', externalRef: 'ff-uid-583', basePriceUsd: 4.75, salePrice: 24000, productType: 'recharge', catalogRef: '849' },
    { label: '630+63💎', externalRef: 'ff-uid-693', basePriceUsd: 5.63, salePrice: 28800, productType: 'recharge' },
    { label: '840+74💎', externalRef: 'ff-uid-914', basePriceUsd: 7.37, salePrice: 38600, productType: 'recharge' },
    { label: '1080+108💎', externalRef: 'ff-uid-1188', basePriceUsd: 9.5, salePrice: 46500, productType: 'recharge', catalogRef: '850' },
    { label: '1180+118💎', externalRef: 'ff-uid-1298', basePriceUsd: 10.36, salePrice: 51500, productType: 'recharge' },
    { label: '1390+139💎', externalRef: 'ff-uid-1529', basePriceUsd: 12.16, salePrice: 61000, productType: 'recharge' },
    { label: '1610+161💎', externalRef: 'ff-uid-1771', basePriceUsd: 14.04, salePrice: 70500, productType: 'recharge' },
    { label: '2200+220💎', externalRef: 'ff-uid-2420', basePriceUsd: 19.0, salePrice: 96000, productType: 'recharge', catalogRef: '851' },
    { label: '2730+273💎', externalRef: 'ff-uid-3003', basePriceUsd: 23.37, salePrice: 120000, productType: 'recharge' },
    { label: '3280+328💎', externalRef: 'ff-uid-3608', basePriceUsd: 27.82, salePrice: 142500, productType: 'recharge' },
    { label: '4400+440💎', externalRef: 'ff-uid-4840', basePriceUsd: 36.61, salePrice: 192000, productType: 'recharge' },
    { label: '4930+493💎', externalRef: 'ff-uid-5423', basePriceUsd: 40.65, salePrice: 216000, productType: 'recharge' },
    { label: '5480+548💎', externalRef: 'ff-uid-6028', basePriceUsd: 44.75, salePrice: 238500, productType: 'recharge' },
    { label: '6600+660💎', externalRef: 'ff-uid-7260', basePriceUsd: 52.83, salePrice: 288000, productType: 'recharge' },
    { label: '7130+713💎', externalRef: 'ff-uid-7843', basePriceUsd: 56.54, salePrice: 312000, productType: 'recharge' },
    { label: '7680+768💎', externalRef: 'ff-uid-8448', basePriceUsd: 60.3, salePrice: 334500, productType: 'recharge' },
    { label: '8800+880💎', externalRef: 'ff-uid-9680', basePriceUsd: 67.67, salePrice: 384000, productType: 'recharge' },
    { label: 'Weekly (450💎)', externalRef: 'ff-uid-weekly', basePriceUsd: 1.61, salePrice: 10500, productType: 'abonnement' },
    { label: 'Monthly (2600💎)', externalRef: 'ff-uid-monthly', basePriceUsd: 7.58, salePrice: 47500, productType: 'abonnement' },
    { label: 'Monthly + Weekly (3050💎)', externalRef: 'ff-uid-monthly-weekly', basePriceUsd: 9.19, salePrice: 58000, productType: 'abonnement' },
  ];

  for (const { catalogRef, ...product } of uidProducts) {
    const sourceCatalogEntryId = catalogRef ? catalogEntryByRef[catalogRef].id : null;
    // stockQty is meaningless for UID top-ups (g2bulk delivers on demand, no fixed
    // inventory) — forced to 0 on every reseed so a stale value never lingers.
    await prisma.product.upsert({
      where: { externalRef: product.externalRef },
      update: { ...product, stockQty: 0, sourceCatalogEntryId },
      create: {
        gameId: game.id,
        categoryId: uidCategory.id,
        isActive: true,
        stockQty: 0,
        deliveryMode: 'auto_g2bulk',
        sourceCatalogEntryId,
        ...product,
      },
    });
  }

  // Placeholder "achat par compte" entries — real list to be defined when that category
  // is tackled (see conversation); kept minimal just so the category isn't empty.
  const compteProducts: ProductSeed[] = [
    { label: 'Weekly (450💎)', externalRef: 'ff-compte-weekly', basePriceUsd: 1.3, salePrice: 9500, productType: 'abonnement' },
    { label: 'Monthly (2600💎)', externalRef: 'ff-compte-monthly', basePriceUsd: 6.2, salePrice: 46000, productType: 'abonnement' },
  ];

  for (const product of compteProducts) {
    await prisma.product.upsert({
      where: { externalRef: product.externalRef },
      update: product,
      create: { gameId: game.id, categoryId: compteCategory.id, isActive: true, stockQty: 0, deliveryMode: 'manual', ...product },
    });
  }

  console.log('Seed complete: Free Fire catalog + g2bulk Middle East supplier reference created.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
