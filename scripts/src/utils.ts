export class AssertionError extends Error {
	name = 'AssertionError';
}

export function assert(condition: boolean, message: string): asserts condition {
	if (!condition) {
		throw new AssertionError(message);
	}
}

export function chunked<T>(arr: T[], size: number): T[][] {
	var i = 0;
	var il = arr.length;

	if (il <= size) {
		return [arr];
	}

	var chunks: T[][] = [];

	for (; i < il; i += size) {
		chunks.push(arr.slice(i, i + size));
	}

	return chunks;
}

export function map_defined<T, R>(array: T[], mapper: (value: T) => R | undefined): R[] {
	var mapped: R[] = [];

	var idx = 0;
	var len = array.length;
	var temp: R | undefined;

	for (; idx < len; idx++) {
		if ((temp = mapper(array[idx])) !== undefined) {
			mapped.push(temp);
		}
	}

	return mapped;
}
