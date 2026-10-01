// One-off bootstrap: creates the single admin account on first setup.
// Re-running it overwrites the existing account, so it's meant to be run once.
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as adminRepository from '../src/repositories/adminRepository';

async function seed() {
  const email = process.env.SEED_ADMIN_EMAIL || 'admin@blackdragon-ff.local';
  const password = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');

  const passwordHash = await bcrypt.hash(password, 10);
  adminRepository.writeAdmin({ email, passwordHash });

  console.log('Admin account created:');
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log('Store this password now — it will not be shown again.');
}

seed();
