import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

import path from 'node:path';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  // When set, the backend also serves the built frontend (single-service deploy)
  frontendDist: process.env.FRONTEND_DIST
    ? path.resolve(process.env.FRONTEND_DIST)
    : null,
};
