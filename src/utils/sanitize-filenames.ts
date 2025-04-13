import { readdir, access } from 'node:fs/promises';
import path from 'path';
import process from 'process';

/**
 * Defines the structure for the sanitization result.
 */
export interface SanitizationResult {
    fileMap: { [originalName: string]: string };
    metadata: {
        totalFiles: number;
        validFiles: number;
        invalidFilesCount: number;
        invalidFiles: string[];
        duplicateBaseNames: { [baseName: string]: number };
        extension: string;
    };
}

/**
 * Checks if a filename matches the pattern: 2 digits, 3 letters, 4 digits.
 */
function isValidFilename(filename: string): boolean {
    const pattern = /^\d{2}[a-zA-Z]{3}\d{4}$/;
    return pattern.test(filename);
}

/**
 * Extracts the first occurrence of the valid pattern from a filename.
 */
function extractValidPart(filename: string): string | null {
    const pattern = /\d{2}[a-zA-Z]{3}\d{4}/g; // Global flag to detect multiple matches
    const matches = [...filename.matchAll(pattern)];
    if (matches.length > 1) {
        const firstMatch = matches[0]?.[0];
        console.warn(`Multiple valid patterns found in ${filename}. Using first match: ${firstMatch}`);
    }
    return matches.length > 0 && matches[0] ? matches[0][0] : null;
}

/**
 * Analyzes .ipynb filenames in the specified directory and proposes sanitized names.
 * Does not rename files.
 * @param directory Optional directory path; defaults to current working directory.
 * @returns A Promise resolving to a SanitizationResult object.
 */
export async function analyzeFilenames(directory: string = ''): Promise<SanitizationResult> {
    const currentDirectory = directory ? path.resolve(directory) : process.cwd();
    const fileExtension = '.ipynb'; // Define the target extension

    // Verify directory exists
    try {
        await access(currentDirectory);
    } catch (error) {
        console.error(`Error: Directory "${currentDirectory}" does not exist or is inaccessible.`);
        // Return a default error structure or throw? Let's return a structure.
        return {
            fileMap: {},
            metadata: {
                totalFiles: 0,
                validFiles: 0,
                invalidFilesCount: 0,
                invalidFiles: [],
                duplicateBaseNames: {},
                extension: fileExtension,
            }
        };
    }

    console.log(`Scanning directory: ${currentDirectory} for ${fileExtension} files`);

    let initialFiles: string[];
    try {
        initialFiles = await readdir(currentDirectory);
    } catch (error) {
        console.error(`Error reading directory: ${error.message}`);
        return {
            fileMap: {},
            metadata: {
                totalFiles: 0,
                validFiles: 0,
                invalidFilesCount: 0,
                invalidFiles: [],
                duplicateBaseNames: {},
                extension: fileExtension,
            }
        };
    }

    const targetFiles = initialFiles.filter(file => file.endsWith(fileExtension));
    console.log(`Found ${targetFiles.length} ${fileExtension} files`);

    const fileMap: { [originalName: string]: string } = {};
    const proposedNames: Set<string> = new Set();
    const duplicates: Map<string, number> = new Map();
    const invalidFilesList: string[] = [];
    let validFileCount = 0;

    // Plan proposed names
    for (const originalFile of targetFiles) {
        const baseName = path.parse(originalFile).name;
        let proposedName: string;
        let isValid = false;

        if (isValidFilename(baseName)) {
            proposedName = originalFile;
            isValid = true;
            validFileCount++;
        } else {
            const validPart = extractValidPart(baseName);
            if (!validPart) {
                console.log(`Warning: Could not extract valid pattern from ${originalFile}. Marking as invalid.`);
                proposedName = originalFile; // Keep original name if invalid pattern
                invalidFilesList.push(originalFile);
            } else {
                proposedName = `${validPart}${fileExtension}`;
                // This file *had* an invalid name, even if we could extract a valid part
                invalidFilesList.push(originalFile);
            }
        }

        let finalProposedName = proposedName;
        const proposedBaseName = path.parse(proposedName).name;

        // Check for potential name collisions among *proposed* names
        let collisionCounter = 1;
        while (proposedNames.has(finalProposedName)) {
            // If a collision occurs, mark the base name as having duplicates
            duplicates.set(proposedBaseName, (duplicates.get(proposedBaseName) || 1) + 1); // Start count from 2 for the first duplicate detected
            finalProposedName = `${proposedBaseName}(${collisionCounter})${fileExtension}`;
            collisionCounter++;
        }

        fileMap[originalFile] = finalProposedName;
        proposedNames.add(finalProposedName);
    }

    // Convert duplicates map to a plain object for the result
    const duplicateBaseNames: { [baseName: string]: number } = {};
    duplicates.forEach((count, baseName) => {
        duplicateBaseNames[baseName] = count;
    });


    const result: SanitizationResult = {
        fileMap,
        metadata: {
            totalFiles: targetFiles.length,
            validFiles: validFileCount,
            invalidFilesCount: invalidFilesList.length,
            invalidFiles: invalidFilesList,
            duplicateBaseNames: duplicateBaseNames,
            extension: fileExtension,
        }
    };

    console.log("\n--- Analysis Summary ---");
    console.log(`Total ${fileExtension} files found: ${result.metadata.totalFiles}`);
    console.log(`Files with initially valid names: ${result.metadata.validFiles}`);
    console.log(`Files with initially invalid names: ${result.metadata.invalidFilesCount}`);
    if (result.metadata.invalidFilesCount > 0) {
        console.log("Invalid files:", result.metadata.invalidFiles);
    }
    if (Object.keys(result.metadata.duplicateBaseNames).length > 0) {
        console.log("Base names leading to potential duplicates after sanitization:", result.metadata.duplicateBaseNames);
    } else {
        console.log("No potential duplicate names detected after sanitization.");
    }


    return result;
}

// Remove or comment out the direct execution part
// const directory = process.argv[2] || '';
// analyzeFilenames(directory).then(result => {
//     console.log("\n--- Result Object ---");
//     console.log(JSON.stringify(result, null, 2));
// });