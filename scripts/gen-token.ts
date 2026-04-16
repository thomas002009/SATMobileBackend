import 'dotenv/config';
import jwt from 'jsonwebtoken';

// Replace with a real user ID from your DB, or use any UUID for a quick smoke test
const userId = process.argv[2] ?? 'test-user-id';

const token = jwt.sign(
  { sub: userId },
  process.env.JWT_SECRET!,
  { expiresIn: '1h' },
);

console.log(token);
