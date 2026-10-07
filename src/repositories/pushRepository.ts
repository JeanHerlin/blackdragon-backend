import prisma from '../config/prisma';

export function upsertSubscription(data: { endpoint: string; p256dh: string; auth: string }) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    create: data,
    update: data,
  });
}

export function deleteByEndpoint(endpoint: string) {
  return prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export function listAll() {
  return prisma.pushSubscription.findMany();
}
