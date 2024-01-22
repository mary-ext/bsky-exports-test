import { sql } from 'drizzle-orm';

import { Agent } from '@externdefs/bluesky-client/agent';

import { db } from './src/db.ts';
import * as schema from './src/schema.ts';
import { EXCLUDED_DIDS } from './data/dids.ts';

const agent = new Agent({ serviceUri: 'https://bsky.network' });

let cursor: string | undefined;
let count = 0;
do {
	const response = await agent.rpc.get('com.atproto.sync.listRepos', {
		params: {
			cursor: cursor,
			limit: 1_000,
		},
	});

	const data = response.data;
	let repos = data.repos;

	// https://github.com/bluesky-social/indigo/issues/526
	if (repos) {
		repos = repos.filter((repo) => !EXCLUDED_DIDS.has(repo.did));

		if (repos.length > 0) {
			db.insert(schema.dids)
				.values(repos.map((repo) => ({ did: repo.did, head: repo.head })))
				.onConflictDoUpdate({
					target: schema.dids.did,
					set: { head: sql`excluded.head`, state: 0 },
					where: sql`excluded.head != dids.head`,
				})
				.run();

			count += repos.length;
		}
	}

	cursor = data.cursor;

	console.log(`${count} dids; cursor: ${cursor}`);
} while (cursor !== undefined);

console.log(`done`);
