import prisma from '../config/prisma';

// Lazily creates the single settings row on first read — avoids a separate seed step.
export async function getSettings() {
  const existing = await prisma.settings.findFirst();
  if (existing) return existing;
  return prisma.settings.create({ data: {} });
}

export async function updateUsdToArRate(usdToArRate: number) {
  const settings = await getSettings();
  return prisma.settings.update({ where: { id: settings.id }, data: { usdToArRate } });
}

export async function updateAdminActive(isAdminActive: boolean) {
  const settings = await getSettings();
  return prisma.settings.update({ where: { id: settings.id }, data: { isAdminActive } });
}
