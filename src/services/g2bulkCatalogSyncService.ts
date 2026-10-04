import * as catalogRepository from '../repositories/catalogRepository';

// Both endpoints are g2bulk's public, keyless catalogue API (verified directly — no
// G2BULK_API_KEY needed for these two reads, unlike the real delivery/order endpoints).
const BASE_URL = 'https://api.g2bulk.com/v1';

interface G2BulkGame {
  id: number;
  code: string;
  name: string;
  image_url: string;
}

interface G2BulkCatalogueItem {
  id: number;
  name: string;
  amount: number;
}

// g2bulk's catalogue items carry no type field (confirmed against their real API) — this
// is only a best-effort default. The admin always gets to confirm/override the type when
// turning an entry into a Product (see catalogService.createProductFromCatalogEntry).
export function inferProductType(name: string): string {
  const trimmed = name.trim();
  if (/^\d+$/.test(trimmed)) return 'recharge';

  const lower = trimmed.toLowerCase();
  if (lower.includes('level up')) return 'levelup';
  if (lower.includes('airdrop') || lower.includes('drop')) return 'largage';
  if (lower.includes('week') || lower.includes('month') || lower.includes('membership')) return 'abonnement';
  return 'recharge';
}

async function fetchFreeFireRegions(): Promise<G2BulkGame[]> {
  const res = await fetch(`${BASE_URL}/games`);
  if (!res.ok) throw new Error(`g2bulk /games failed with HTTP ${res.status}`);
  const body = (await res.json()) as { games: G2BulkGame[] };
  return body.games.filter((g) => g.code.startsWith('freefire_'));
}

async function fetchCatalogue(code: string): Promise<G2BulkCatalogueItem[]> {
  const res = await fetch(`${BASE_URL}/games/${code}/catalogue`);
  if (!res.ok) return []; // a region g2bulk can't currently serve shouldn't fail the whole sync
  const body = (await res.json()) as { catalogues: G2BulkCatalogueItem[] };
  return body.catalogues;
}

export async function syncAllRegions(gameId: string) {
  const regions = await fetchFreeFireRegions();
  const regionsSynced: string[] = [];
  let entryCount = 0;

  for (const region of regions) {
    const items = await fetchCatalogue(region.code);
    if (items.length === 0) continue;

    for (const item of items) {
      await catalogRepository.upsertSupplierCatalogEntry({
        gameId,
        supplier: 'g2bulk',
        region: region.code,
        supplierRef: String(item.id),
        name: item.name,
        basePriceUsd: item.amount,
        productType: inferProductType(item.name),
      });
      entryCount++;
    }
    regionsSynced.push(region.code);
  }

  return { regionsSynced, entryCount };
}
