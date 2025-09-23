#!/bin/sh
set -eu

if [ -f "/app/prisma/schema.prisma" ]; then
  npx prisma migrate deploy
  npx prisma generate
fi

node dist/index.js
