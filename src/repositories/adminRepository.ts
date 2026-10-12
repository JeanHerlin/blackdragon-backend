import prisma from '../config/prisma';

export interface AdminRecord {
  email: string;
  passwordHash: string;
}

// Only ever one row — single-admin product, see schema.prisma's Admin model comment.
export async function getAdmin(): Promise<AdminRecord | null> {
  return prisma.admin.findFirst();
}

// Create-or-replace: the only admin row becomes exactly this email/hash, matching the
// previous JSON-file behavior (writeAdmin always fully overwrote the file).
export async function writeAdmin(admin: AdminRecord): Promise<void> {
  const existing = await prisma.admin.findFirst();
  if (existing) {
    await prisma.admin.update({ where: { id: existing.id }, data: admin });
  } else {
    await prisma.admin.create({ data: admin });
  }
}
