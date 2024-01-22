import { eq, sql } from 'drizzle-orm';

import { Agent } from '@externdefs/bluesky-client/agent';
import type { DID, Records } from '@externdefs/bluesky-client/atp-schema';
import { XRPCError } from '@externdefs/bluesky-client/xrpc-utils';

import { CarBlockIterator } from '@ipld/car';

import { db } from './src/db.ts';
import * as schema from './src/schema.ts';

import { type BlockMap, type Commit, read_obj, verify_cid_for_bytes, walk_mst_entries } from './src/mst.ts';
import { assert, chunked } from './src/utils.ts';

type PostRecord = Records['app.bsky.feed.post'];

const agent = new Agent({ serviceUri: 'https://bsky.network' });

jump: while (true) {
	const unindexed_repos = db
		.select({ did: schema.dids.did })
		.from(schema.dids)
		.where(eq(schema.dids.state, 0))
		.limit(1_000)
		.all();

	if (unindexed_repos.length === 0) {
		break;
	}

	for (let i = 0, il = unindexed_repos.length; i < il; i++) {
		const { did } = unindexed_repos[i];

		console.log(`processing ${did}`);

		// Retrieve the repository
		let buf: Uint8Array;
		try {
			console.log(`  downloading repository`);
			const response = await agent.rpc.get('com.atproto.sync.getRepo', {
				params: {
					did: did as DID,
				},
			});

			buf = response.data as Uint8Array;
			if (!(buf instanceof Uint8Array)) {
				throw new TypeError(`expected response to be uint8`);
			}

			console.log(`  ..got ${buf.byteLength} bytes`);
		} catch (err) {
			if (err instanceof XRPCError) {
				const errn = err.error;

				if (errn === 'user not found' || errn === 'failed to read repo into buffer') {
					db.update(schema.dids).set({ state: 2 }).where(eq(schema.dids.did, did)).run();
					continue;
				} else if (errn === 'account was deleted') {
					db.update(schema.dids).set({ state: 3 }).where(eq(schema.dids.did, did)).run();
					continue;
				} else if (errn === 'account was taken down') {
					db.update(schema.dids).set({ state: 4 }).where(eq(schema.dids.did, did)).run();
					continue;
				}
			}

			throw err;
		}

		const posts = new Map<string, PostRecord>();
		let head: string;

		// Read the repository
		{
			console.log(`  reading repository`);
			const car = await CarBlockIterator.fromBytes(buf);
			const roots = await car.getRoots();

			assert(roots.length === 1, `expected 1 root commit`);

			const root_cid = roots[0];
			const blockmap: BlockMap = new Map();

			for await (const { cid, bytes } of car) {
				await verify_cid_for_bytes(cid, bytes);
				blockmap.set(cid.toString(), bytes);
			}

			const commit = read_obj(blockmap, root_cid) as Commit;
			console.log(`  ..head is ${root_cid.toString()}`);

			for (const { key, cid } of walk_mst_entries(blockmap, commit.data)) {
				const [collection, rkey] = key.split('/');

				if (collection === 'app.bsky.feed.post') {
					const record = read_obj(blockmap, cid) as PostRecord;
					posts.set(rkey, record);
				}
			}

			head = root_cid.toString();

			console.log(`  ..got ${posts.size} posts`);
		}

		// Write to database
		{
			console.log(`  writing to database`);

			const post_values: { did: string; rkey: string; text: string; created_at: Date }[] = [];
			const lang_values: { did: string; rkey: string; lang: string }[] = [];

			for (const [rkey, record] of posts) {
				const date = new Date(record.createdAt);
				const langs = record.langs;

				post_values.push({ did: did, rkey: rkey, text: record.text, created_at: date });

				if (Array.isArray(langs)) {
					for (const lang of langs) {
						lang_values.push({ did: did, rkey: rkey, lang: lang });
					}
				}
			}

			db.transaction((tx) => {
				if (post_values.length > 0) {
					for (const chunk of chunked(post_values, 2_000)) {
						tx.insert(schema.posts).values(chunk).onConflictDoNothing().run();
					}
				}

				if (lang_values.length > 0) {
					for (const chunk of chunked(lang_values, 2_000)) {
						tx.insert(schema.post_langs).values(chunk).onConflictDoNothing().run();
					}
				}

				tx.update(schema.dids).set({ state: 1, head: head }).where(eq(schema.dids.did, did)).run();
			});
		}
	}
}

console.log(`done`);
