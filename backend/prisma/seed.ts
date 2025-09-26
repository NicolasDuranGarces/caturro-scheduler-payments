import { PrismaClient, Role } from '@prisma/client';
import env from '../src/config/env';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await hashPassword(env.ADMIN_DEFAULT_PASSWORD);

  await prisma.user.upsert({
    where: { email: 'admin@caturro.cafe' },
    update: {},
    create: {
      email: 'admin@caturro.cafe',
      password: adminPassword,
      firstName: 'Catalina',
      lastName: 'Pantera',
      role: Role.ADMIN,
      hourlyRate: 8200,
      notes: 'Head barista and scheduler',
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Seed finished for ${env.APP_NAME}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
