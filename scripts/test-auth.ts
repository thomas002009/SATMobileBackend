import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const BASE_URL = 'http://localhost:3000';

async function main() {
  // 1. Create a temp user in the DB
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter } as any);

  const user = await prisma.user.create({
    data: { email: `test-${Date.now()}@example.com`, password: 'test' },
  });
  console.log('Created test user:', user.id);

  // 2. Mint a token for that user
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET!, { expiresIn: '1h' });

  // 3. Hit /users/me WITH the token
  const authed = await fetch(`${BASE_URL}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log('\n✓ With valid token →', authed.status, await authed.json());

  // 4. Hit /users/me WITHOUT a token
  const unauthed = await fetch(`${BASE_URL}/users/me`);
  console.log('✗ No token →', unauthed.status, await unauthed.json());

  // 5. Clean up
  await prisma.user.delete({ where: { id: user.id } });
  console.log('\nTest user cleaned up.');

  await prisma.$disconnect();
}

main().catch(console.error);
