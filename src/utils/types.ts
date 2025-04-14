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
    validIpynbFiles: { [originalName: string]: string };

    /**
     * List of invalid files with detailed information about why they're invalid
     */
    invalidFiles: InvalidFileInfo[];

    /**
     * File extension that was processed (e.g., "ipynb")
     */
    fileExtension: string;
}