import { randomInt } from 'node:crypto';
import { prisma } from './prisma.js';

// No 0/O/1/I/L — codes get read aloud courtside
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}

export async function uniqueMatchCode(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const existing = await prisma.match.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw new Error('Could not generate a unique match code');
}
