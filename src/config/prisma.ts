import { PrismaClient } from '@prisma/client';

// Single shared client — repositories import this instead of instantiating their own.
const prisma = new PrismaClient();

export default prisma;
