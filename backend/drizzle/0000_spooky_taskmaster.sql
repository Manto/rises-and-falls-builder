CREATE TABLE `characters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`blurb` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `characters_name_unique` ON `characters` (`name`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`blurb` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_name_unique` ON `locations` (`name`);--> statement-breakpoint
CREATE TABLE `preconditions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scene_id` integer NOT NULL,
	`variable_id` integer NOT NULL,
	`operator` text NOT NULL,
	`value` real NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variable_id`) REFERENCES `variables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_preconditions_scene` ON `preconditions` (`scene_id`);--> statement-breakpoint
CREATE INDEX `idx_preconditions_variable` ON `preconditions` (`variable_id`);--> statement-breakpoint
CREATE TABLE `scene_characters` (
	`scene_id` integer NOT NULL,
	`character_id` integer NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_scene_characters_scene` ON `scene_characters` (`scene_id`);--> statement-breakpoint
CREATE INDEX `idx_scene_characters_character` ON `scene_characters` (`character_id`);--> statement-breakpoint
CREATE TABLE `scenes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`location_id` integer,
	`what` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_scenes_location` ON `scenes` (`location_id`);--> statement-breakpoint
CREATE TABLE `variable_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`scene_id` integer NOT NULL,
	`variable_id` integer NOT NULL,
	`delta` real NOT NULL,
	FOREIGN KEY (`scene_id`) REFERENCES `scenes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variable_id`) REFERENCES `variables`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_variable_changes_scene` ON `variable_changes` (`scene_id`);--> statement-breakpoint
CREATE INDEX `idx_variable_changes_variable` ON `variable_changes` (`variable_id`);--> statement-breakpoint
CREATE TABLE `variables` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`default_value` real DEFAULT 0 NOT NULL,
	`type` text DEFAULT 'World State' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `variables_name_unique` ON `variables` (`name`);