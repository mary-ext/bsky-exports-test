import type { Config } from 'drizzle-kit';

export default {
	schema: './scripts/src/schema.ts',
	out: './drizzle',
} satisfies Config;
