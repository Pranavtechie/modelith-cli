/**
 * Enum representing different reasons why a file might be invalid
 */
export enum InvalidFileReason {
    DUPLICATE = "duplicate",
    UNSANITIZABLE = "unsanitizable",
    INVALID_FORMAT = "invalid_format",
    CORRUPTED = "corrupted"
}

/**
 * Defines the structure for information about invalid files
 */
export interface InvalidFileInfo {
    filename: string;
    reason: InvalidFileReason;
    details?: string;
    duplicateOf?: string; // If reason is DUPLICATE, reference to the original file
    lastModified?: Date;   // Might be useful for understanding duplicates
}

/**
 * Defines the structure for the sanitization result.
 */
export interface SanitizationResult {
    /**
     * Total number of files found in the directory
     */
    totalFilesInDirectory: number;

    /**
     * Valid ipynb files mapping from original filenames to their sanitized names
     */
    validFiles: { [originalName: string]: string };

    /**
     * List of invalid files with detailed information about why they're invalid
     */
    invalidFiles: InvalidFileInfo[];

    /**
     * File extension that was processed (e.g., "ipynb")
     */
    fileExtension: string;
}

/**
 * Defines the structure for Notebook Metadata based on the database schema.
 */
export interface NotebookMetadataObject {
    notebookId: string;
    runId: string | null;
    filename: string;
    totalCells: number | null;
    codeCells: number | null;
    markdownCells: number | null;
    cellExecutionCount: Record<string, any> | null; // JSON blob
    magicCommandUsage: number | null;
    outputCellsCount: number | null;
    errorCellCount: number | null;
    codeReusabilityMetric: number | null;
    codeVsMarkdownRatio: number | null;
    totalLinesOfCode: number | null;
    totalLinesInMarkdown: number | null;
    uniqueImports: number | null;
    totalExecutionTime: number | null;
    executionTimeDeltaPerCell: Record<string, any> | null; // JSON blob
    linkCount: number | null;
    widgetUsage: number | null;
    executionOrderDisorder: boolean | null;
    astNodeCount: number | null;
    astDepth: number | null;
    functionDefinitionsCount: number | null;
    classDefinitionsCount: number | null;
    numberOfFunctionCalls: number | null;
    numberOfLoopConstructs: number | null;
    numberOfConditionalStatements: number | null;
    numberOfVariableAssignments: number | null;
    estimatedCyclomaticComplexity: number | null;
    exceptionHandlingBlocksCount: number | null;
    recursionDetectionStatus: boolean | null;
    comprehensionCount: number | null;
    binaryOperationCount: number | null;
    meanIdentifierLength: number | null;
    keywordDensity: number | null;
    metadataJson: Record<string, any> | null; // JSON blob
    ipynbOrigin: "google-colab" | "kaggle" | "jupyter" | null;
    studentId: string | null;
}

export interface NotebookMetricsSubset extends Omit<NotebookMetadataObject, 'notebookId' | 'runId' | 'studentId'> { }