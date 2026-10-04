import type { Prisma } from '@prisma/client';
import prisma from '../config/prisma';

export async function getOrCreate(psid: string) {
  const existing = await prisma.conversationState.findUnique({ where: { psid } });
  if (existing) return existing;
  return prisma.conversationState.create({ data: { psid } });
}

export function updateState(psid: string, step: string, data: Record<string, unknown>) {
  return prisma.conversationState.update({ where: { psid }, data: { step, data: data as Prisma.InputJsonValue } });
}

export function resetState(psid: string) {
  return prisma.conversationState.update({ where: { psid }, data: { step: 'start', data: {} } });
}
