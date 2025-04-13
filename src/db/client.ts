import { loadEnv } from '@/utils/config';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';

await loadEnv();
const sqlite = new Database(Bun.env.DB_FILE_NAME);
export const db = drizzle(sqlite);