CREATE TABLE `Cohort` (
	`cohortId` text PRIMARY KEY NOT NULL,
	`className` text,
	`timestamp` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Cohort_className_unique` ON `Cohort` (`className`);--> statement-breakpoint
CREATE TABLE `NotebookMetadata` (
	`notebookId` text PRIMARY KEY NOT NULL,
	`runId` text,
	`filename` text NOT NULL,
	`totalCells` integer,
	`codeCells` integer,
	`markdownCells` integer,
	`cellExecutionCount` blob,
	`magicCommandUsage` integer,
	`outputCellsCount` integer,
	`errorCellCount` integer,
	`codeReusabilityMetric` real,
	`codeVsMarkdownRatio` real,
	`totalLinesOfCode` integer,
	`totalLinesInMarkdown` integer,
	`uniqueImports` integer,
	`totalExecutionTime` real,
	`executionTimeDeltaPerCell` blob,
	`linkCount` integer,
	`widgetUsage` integer,
	`executionOrderDisorder` integer,
	`astNodeCount` integer,
	`astDepth` integer,
	`functionDefinitionsCount` integer,
	`classDefinitionsCount` integer,
	`numberOfFunctionCalls` integer,
	`numberOfLoopConstructs` integer,
	`numberOfConditionalStatements` integer,
	`numberOfVariableAssignments` integer,
	`estimatedCyclomaticComplexity` integer,
	`exceptionHandlingBlocksCount` integer,
	`recursionDetectionStatus` integer,
	`comprehensionCount` integer,
	`binaryOperationCount` integer,
	`meanIdentifierLength` real,
	`keywordDensity` real,
	`metadataJson` blob,
	`ipynbOrigin` text,
	`studentId` text,
	FOREIGN KEY (`runId`) REFERENCES `Run`(`runId`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`studentId`) REFERENCES `Student`(`studentId`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Run` (
	`runId` text PRIMARY KEY NOT NULL,
	`runHash` text,
	`name` text,
	`timestamp` integer NOT NULL,
	`notebookCount` integer NOT NULL,
	`cohortId` text,
	FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`cohortId`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Similarity` (
	`runId` text,
	`studentA` text NOT NULL,
	`studentB` text NOT NULL,
	`similarityScore` real NOT NULL,
	`treeEditDistance` real NOT NULL,
	PRIMARY KEY(`studentA`, `studentB`, `runId`),
	FOREIGN KEY (`runId`) REFERENCES `Run`(`runId`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`studentA`) REFERENCES `Student`(`studentId`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`studentB`) REFERENCES `Student`(`studentId`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `Student` (
	`studentId` text PRIMARY KEY NOT NULL,
	`cohortId` text NOT NULL,
	`name` text,
	`regNo` text,
	FOREIGN KEY (`cohortId`) REFERENCES `Cohort`(`cohortId`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `unique_regNo_cohort` ON `Student` (`regNo`,`cohortId`);