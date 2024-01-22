CREATE TABLE `dids` (
	`did` text PRIMARY KEY NOT NULL,
	`head` text NOT NULL,
	`state` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `post_langs` (
	`did` text NOT NULL,
	`rkey` text NOT NULL,
	`lang` text NOT NULL,
	PRIMARY KEY(`did`, `lang`, `rkey`),
	FOREIGN KEY (`did`) REFERENCES `dids`(`did`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`did`,`rkey`) REFERENCES `posts`(`did`,`rkey`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`did` text NOT NULL,
	`rkey` text NOT NULL,
	`text` text NOT NULL,
	PRIMARY KEY(`did`, `rkey`),
	FOREIGN KEY (`did`) REFERENCES `dids`(`did`) ON UPDATE no action ON DELETE no action
);
