import { foreignKey, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const dids = sqliteTable('dids', {
	did: text('did').notNull().primaryKey(),
	head: text('head').notNull(),
	/** 0: unindexed, 1: indexed, 2: not found, 3: tombstoned, 4: taken down */
	state: integer('state', { mode: 'number' }).notNull().default(0),
});

export const posts = sqliteTable(
	'posts',
	{
		did: text('did')
			.notNull()
			.references(() => dids.did),
		rkey: text('rkey').notNull(),
		text: text('text').notNull(),
		created_at: integer('created_at', { mode: 'timestamp' }),
	},
	(table) => {
		return {
			pk: primaryKey({
				columns: [table.did, table.rkey],
			}),
		};
	},
);

export const post_langs = sqliteTable(
	'post_langs',
	{
		did: text('did')
			.notNull()
			.references(() => dids.did),
		rkey: text('rkey').notNull(),
		lang: text('lang').notNull(),
	},
	(table) => {
		return {
			pk: primaryKey({
				columns: [table.did, table.rkey, table.lang],
			}),
			fk: foreignKey({
				columns: [table.did, table.rkey],
				foreignColumns: [posts.did, posts.rkey],
			}),
		};
	},
);
