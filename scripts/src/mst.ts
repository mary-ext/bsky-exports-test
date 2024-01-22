import { decode as decode_cbor } from '@ipld/dag-cbor';
import { CID } from 'multiformats/cid';

import { assert } from './utils';
import { sha256 } from 'multiformats/hashes/sha2';

export type BlockMap = Map<string, Uint8Array>;

export interface Commit {
	version: 3;
	did: string;
	data: CID;
	rev: string;
	prev: CID | null;
	sig: Uint8Array;
}

export interface TreeEntry {
	/** count of bytes shared with previous TreeEntry in this Node (if any) */
	p: number;
	/** remainder of key for this TreeEntry, after "prefixlen" have been removed */
	k: Uint8Array;
	/** link to a sub-tree Node at a lower level which has keys sorting after this TreeEntry's key (to the "right"), but before the next TreeEntry's key in this Node (if any) */
	v: CID;
	/** next subtree (to the right of leaf) */
	t: CID | null;
}

export interface MstNode {
	/** link to sub-tree Node on a lower level and with all keys sorting before keys at this node */
	l: CID | null;
	/** ordered list of TreeEntry objects */
	e: TreeEntry[];
}

export interface NodeEntry {
	key: string;
	cid: CID;
}

const decoder = new TextDecoder();

export function* walk_mst_entries(map: BlockMap, pointer: CID): Generator<NodeEntry> {
	// console.log(`  ..walking to ${pointer.toString()}`);
	const data = read_obj(map, pointer) as MstNode;
	const entries = data.e;

	let last_key = '';

	if (data.l !== null) {
		yield* walk_mst_entries(map, data.l);
	}

	for (let i = 0, il = entries.length; i < il; i++) {
		const entry = entries[i];

		const key_str = decoder.decode(entry.k);
		const key = last_key.slice(0, entry.p) + key_str;

		last_key = key;

		yield { key: key, cid: entry.v };

		if (entry.t !== null) {
			yield* walk_mst_entries(map, entry.t);
		}
	}
}

export async function verify_cid_for_bytes(cid: CID, bytes: Uint8Array) {
	const digest = await sha256.digest(bytes);
	const expected = CID.createV1(cid.code, digest);

	assert(cid.equals(expected), `expected cid to be ${expected} but got ${cid}`);
}

export function read_obj(map: Map<string, Uint8Array>, cid: CID) {
	const bytes = map.get(cid.toString());
	assert(bytes != null, `cid not found in blockmap`);

	const data = decode_cbor(bytes);

	return data;
}
