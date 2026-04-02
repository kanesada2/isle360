CREATE TABLE `player` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `score` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`player_id` text NOT NULL,
	`seed` integer NOT NULL,
	`score` integer NOT NULL,
	`log` text NOT NULL,
	`date` integer NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `score_score_idx` ON `score` (`score`) WHERE "score"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `score_score_date_seed_idx` ON `score` (`score`,`date`,`seed`) WHERE "score"."deleted_at" is null;--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`player_id` text NOT NULL,
	`seed` integer NOT NULL,
	`used_flag` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `session_player_id_created_at_idx` ON `session` (`player_id`,`created_at`);