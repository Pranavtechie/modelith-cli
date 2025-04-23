import { sqliteTable, text, integer, real, blob, primaryKey, unique } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { randomUUIDv7 } from "bun";
import { timestamp } from "drizzle-orm/gel-core";

// Enums (SQLite doesn't support native enums, so we use text with type constraints)
const ipynbOriginEnum = ["google-colab", "kaggle", "jupyter"] as const;

// Tables
export const Run = sqliteTable("Run", {
    runId: text("runId").primaryKey().$defaultFn(() => randomUUIDv7()),
    runHash: text("runHash"),
    name: text("name"),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
    notebookCount: integer("notebookCount").notNull(),
    cohortId: text("cohortId").references(() => Cohort.cohortId),
});

export const NotebookMetadata = sqliteTable("NotebookMetadata", {
    notebookId: text("notebookId").primaryKey().$defaultFn(() => randomUUIDv7()),
    runId: text("runId").references(() => Run.runId),
    filename: text("filename").notNull(),
    totalCells: integer("totalCells"),
    codeCells: integer("codeCells"),
    markdownCells: integer("markdownCells"),
    cellExecutionCount: blob("cellExecutionCount", { mode: "json" }),
    magicCommandUsage: integer("magicCommandUsage"),
    outputCellsCount: integer("outputCellsCount"),
    errorCellCount: integer("errorCellCount"),
    codeReusabilityMetric: real("codeReusabilityMetric"),
    codeVsMarkdownRatio: real("codeVsMarkdownRatio"),
    totalLinesOfCode: integer("totalLinesOfCode"),
    totalLinesInMarkdown: integer("totalLinesInMarkdown"),
    uniqueImports: integer("uniqueImports"),
    totalExecutionTime: real("totalExecutionTime"),
    executionTimeDeltaPerCell: blob("executionTimeDeltaPerCell", { mode: "json" }),
    linkCount: integer("linkCount"),
    widgetUsage: integer("widgetUsage"),
    executionOrderDisorder: integer("executionOrderDisorder", { mode: "boolean" }),
    astNodeCount: integer("astNodeCount"),
    astDepth: integer("astDepth"),
    functionDefinitionsCount: integer("functionDefinitionsCount"),
    classDefinitionsCount: integer("classDefinitionsCount"),
    numberOfFunctionCalls: integer("numberOfFunctionCalls"),
    numberOfLoopConstructs: integer("numberOfLoopConstructs"),
    numberOfConditionalStatements: integer("numberOfConditionalStatements"),
    numberOfVariableAssignments: integer("numberOfVariableAssignments"),
    estimatedCyclomaticComplexity: integer("estimatedCyclomaticComplexity"),
    exceptionHandlingBlocksCount: integer("exceptionHandlingBlocksCount"),
    recursionDetectionStatus: integer("recursionDetectionStatus", { mode: "boolean" }),
    comprehensionCount: integer("comprehensionCount"),
    binaryOperationCount: integer("binaryOperationCount"),
    meanIdentifierLength: real("meanIdentifierLength"),
    keywordDensity: real("keywordDensity"),
    metadataJson: blob("metadataJson", { mode: "json" }),
    ipynbOrigin: text("ipynbOrigin").$type<typeof ipynbOriginEnum[number]>(),
    studentId: text("studentId").references(() => Student.studentId),
});

export const Similarity = sqliteTable("Similarity", {
    runId: text("runId").references(() => Run.runId),
    studentA: text("studentA").references(() => Student.studentId).notNull(),
    studentB: text("studentB").references(() => Student.studentId).notNull(),
    similarityScore: real("similarityScore").notNull(),
    treeEditDistance: real("treeEditDistance").notNull(),
}, (table) => ({
    pk: primaryKey({ columns: [table.studentA, table.studentB, table.runId] }),
}));

export const Cohort = sqliteTable("Cohort", {
    cohortId: text("cohortId").primaryKey().$defaultFn(() => randomUUIDv7()),
    className: text("className").unique(),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
});

export const Student = sqliteTable("Student", {
    studentId: text("studentId").primaryKey().$defaultFn(() => randomUUIDv7()),
    cohortId: text("cohortId").references(() => Cohort.cohortId).notNull(), // Added .notNull()
    name: text("name"),
    regNo: text("regNo"),
}, (table) => ({ // Added unique constraint
    uniqueRegNoCohort: unique("unique_regNo_cohort").on(table.regNo, table.cohortId),
}));

// Relations
export const RunRelations = relations(Run, ({ one, many }) => ({
    class: one(Cohort, { fields: [Run.cohortId], references: [Cohort.cohortId] }),
    notebooks: many(NotebookMetadata),
    Similarity: many(Similarity),
}));

export const notebookMetadataRelations = relations(NotebookMetadata, ({ one }) => ({
    run: one(Run, { fields: [NotebookMetadata.runId], references: [Run.runId] }),
    student: one(Student, { fields: [NotebookMetadata.studentId], references: [Student.studentId] }),
}));

export const SimilarityRelations = relations(Similarity, ({ one }) => ({
    run: one(Run, { fields: [Similarity.runId], references: [Run.runId] }),
}));

export const CohortRelations = relations(Cohort, ({ many }) => ({
    Run: many(Run),
    Student: many(Student),
}));

export const StudentRelations = relations(Student, ({ one, many }) => ({
    class: one(Cohort, { fields: [Student.cohortId], references: [Cohort.cohortId] }),
    notebooks: many(NotebookMetadata),
}));