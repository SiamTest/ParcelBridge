import { createClient } from '@libsql/client';
import { readFile } from 'node:fs/promises';
const url = process.env.TURSO_DATABASE_URL;
if (!url || !process.env.TURSO_AUTH_TOKEN) throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your environment');
const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try { await db.executeMultiple(await readFile(new URL('../schema.sql', import.meta.url), 'utf8')); console.log('Schema applied (existing records preserved).'); }
finally { db.close(); }
