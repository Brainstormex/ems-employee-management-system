#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting EMS API on port ${PORT:-4000}..."
exec node dist/index.js
