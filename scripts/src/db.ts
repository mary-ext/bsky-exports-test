import { Database } from 'bun:sqlite';

import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';

export const raw_db = new Database('db.sqlite');
export const db = drizzle(raw_db);

raw_db.exec("PRAGMA journal_mode = WAL;");
migrate(db, { migrationsFolder: './drizzle' });
