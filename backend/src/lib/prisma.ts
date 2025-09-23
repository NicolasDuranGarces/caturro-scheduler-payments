import { PrismaClient } from '@prisma/client';
import env from '../config/env';

const prisma = new PrismaClient({
  log: env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
});

export default prisma;
