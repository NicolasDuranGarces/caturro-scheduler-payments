import env from './config/env';
import app from './app';
import prisma from './lib/prisma';

const server = app.listen(env.BACKEND_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 ${env.APP_NAME} listening on port ${env.BACKEND_PORT}`);
});

const shutdown = async (signal: string) => {
  // eslint-disable-next-line no-console
  console.log(`\nReceived ${signal}. Closing server...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
