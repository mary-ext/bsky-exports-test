import { sql } from 'drizzle-orm';

import { Agent } from '@externdefs/bluesky-client/agent';

import { db } from './src/db.ts';
import * as schema from './src/schema.ts';
import { EXCLUDED_DIDS } from './data/dids.ts';
import { map_defined } from './src/utils.ts';

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

	// https://github.com/bluesky-social/indigo/issues/526
	const repos = map_defined(data.repos || [], ({ did, head }) => {
		if (EXCLUDED_DIDS.has(did)) {
			return;
		}

		return { did: did, head: head };
	});

	if (repos.length > 0) {
		db.insert(schema.dids)
			.values(repos)
			.onConflictDoUpdate({
				target: schema.dids.did,
				set: { head: sql`excluded.head`, state: 0 },
				where: sql`excluded.head != dids.head`,
			})
			.run();

		count += repos.length;
	}

	cursor = data.cursor;

	console.log(`${count} dids; cursor: ${cursor}`);
} while (cursor !== undefined);

console.log(`done`);
