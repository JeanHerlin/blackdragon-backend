import fs from 'fs';
import path from 'path';

export interface AdminRecord {
  email: string;
  passwordHash: string;
}

const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'admin.json');

function readAdmin(): AdminRecord {
  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(`No admin account found. Run "npm run seed:admin" first (${DATA_FILE} is missing).`);
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

export function writeAdmin(admin: AdminRecord): void {
  fs.writeFileSync(DATA_FILE, JSON.stringify(admin, null, 2));
}

export function getAdmin(): AdminRecord {
  return readAdmin();
}

export function updatePasswordHash(passwordHash: string): AdminRecord {
  const admin = readAdmin();
  admin.passwordHash = passwordHash;
  writeAdmin(admin);
  return admin;
}

export { DATA_FILE };
