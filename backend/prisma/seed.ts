import { PrismaClient, Role } from '@prisma/client';
import env from '../src/config/env';
import { hashPassword } from '../src/utils/password';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await hashPassword(env.ADMIN_DEFAULT_PASSWORD);
  const baristaPassword = await hashPassword(env.BARISTA_DEFAULT_PASSWORD);

  const admin = await prisma.user.upsert({
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

  const barista1 = await prisma.user.upsert({
    where: { email: 'samira@caturro.cafe' },
    update: {
      hourlyRate: 5600,
    },
    create: {
      email: 'samira@caturro.cafe',
      password: baristaPassword,
      firstName: 'Samira',
      lastName: 'Lopez',
      role: Role.BARISTA,
      hourlyRate: 5600,
    },
  });

  const barista2 = await prisma.user.upsert({
    where: { email: 'dario@caturro.cafe' },
    update: {
      hourlyRate: 5800,
    },
    create: {
      email: 'dario@caturro.cafe',
      password: baristaPassword,
      firstName: 'Dario',
      lastName: 'Vera',
      role: Role.BARISTA,
      hourlyRate: 5800,
    },
  });

  const upcomingMonday = (() => {
    const date = new Date();
    const day = date.getDay();
    const diff = (1 + 7 - day) % 7 || 7; // next Monday
    date.setDate(date.getDate() + diff);
    date.setHours(7, 30, 0, 0);
    return date;
  })();

  await prisma.scheduleEntry.deleteMany({});

  const entries = [
    { user: barista1, startHour: 7, endHour: 13, title: 'Apertura turnos espresso' },
    { user: barista2, startHour: 13, endHour: 19, title: 'Cierre barra filtrados' },
  ];

  await Promise.all(entries.flatMap(({ user, startHour, endHour, title }) => {
    return Array.from({ length: 5 }).map((_, index) => {
      const start = new Date(upcomingMonday);
      start.setDate(start.getDate() + index);
      start.setHours(startHour, 0, 0, 0);
      const end = new Date(start);
      end.setHours(endHour, 0, 0, 0);
      return prisma.scheduleEntry.create({
        data: {
          title,
          userId: user.id,
          start,
          end,
          color: '#4f46e5',
        },
      });
    });
  }));

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
