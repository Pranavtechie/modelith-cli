import { readdir, access, stat } from 'node:fs/promises';
import path from 'path';
import process from 'process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { type SanitizationResult, InvalidFileReason, type InvalidFileInfo } from '@utils/types';


/**
 * Checks if a filename *exactly* matches the valid registration number pattern: 2 digits, 3 letters, 4 digits.
 */
function isStrictlyValidFilename(filename: string): boolean {
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
        console.warn(`Multiple valid patterns found in ${chalk.blue.bold(filename)}. Using first match: ${chalk.blue.bold(firstMatch)}`);
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
        console.error(`Error: Directory "${chalk.blue.bold(currentDirectory)}" does not exist or is inaccessible.`);
        return {
            totalFilesInDirectory: 0,
            validFiles: {},
            invalidFiles: [],
            fileExtension: fileExtension
        };
    }


    let initialFiles: string[];
    try {
        initialFiles = await readdir(currentDirectory);
        console.log(`\n${chalk.cyan.bold('Scanning directory:')} ${chalk.white.bold(currentDirectory)}`);
        console.log(`${chalk.cyan.bold('Total files found:')} ${chalk.white.bold(initialFiles.length)}`);
    } catch (error) {
        console.error(`Error reading directory: ${String(error)}`);
        return {
            totalFilesInDirectory: 0,
            validFiles: {},
            invalidFiles: [],
            fileExtension: fileExtension
        };
    }

    const targetFiles = initialFiles.filter(file => file.endsWith(fileExtension));
    console.log(`\n${chalk.green.bold('Found')} ${chalk.green.bold(targetFiles.length)} ${chalk.green.bold(fileExtension + ' files')} out of ${chalk.white.bold(initialFiles.length)} total files`);

    const validIpynbFiles: { [originalName: string]: string } = {};
    const proposedNames: Set<string> = new Set();
    const duplicates: Map<string, number> = new Map();
    const invalidFilesList: InvalidFileInfo[] = []; // List to store all invalid files with reasons

    // Plan proposed names
    for (const originalFile of targetFiles) {
        const baseName = path.parse(originalFile).name;
        let proposedName: string;

        if (isStrictlyValidFilename(baseName)) {
            // Filename is already perfect - extract just the registration number and convert to uppercase
            proposedName = baseName.toUpperCase();
        } else {
            // Filename is not perfect, try to extract a valid part
            const validPart = extractValidPart(baseName);
            if (validPart) {
                // Successfully extracted a valid part, propose a sanitized name (uppercase, no extension)
                proposedName = validPart.toUpperCase();
                // Note: This file was initially invalid but is now sanitizable.
            } else {
                // Could not extract a valid pattern, mark as unsanitizable
                proposedName = originalFile; // Keep original name
                // Add to the list of invalid files with reason
                invalidFilesList.push({
                    filename: originalFile,
                    reason: InvalidFileReason.UNSANITIZABLE,
                    details: "Could not extract valid registration number pattern"
                });
            }
        }

        let finalProposedName = proposedName;
        // For unsanitizable files, we may still have the original filename with extension
        const proposedBaseName = proposedName.endsWith(fileExtension) ? path.parse(proposedName).name : proposedName;

        // Check for potential name collisions among *proposed* names
        let collisionCounter = 1;
        while (proposedNames.has(finalProposedName)) {
            // If a collision occurs, mark the base name as having duplicates
            duplicates.set(proposedBaseName, (duplicates.get(proposedBaseName) || 1) + 1); // Start count from 2 for the first duplicate detected
            finalProposedName = `${proposedBaseName}(${collisionCounter})`;
            collisionCounter++;
        }

        validIpynbFiles[originalFile] = finalProposedName;
        proposedNames.add(finalProposedName);
    }

    // Collect file metadata for potential duplicates
    const duplicateGroups: { [proposedBaseName: string]: { originalFile: string; lastModified: Date }[] } = {};
    const duplicateFiles: { [regNo: string]: Array<{ originalFilename: string; isSelected: boolean; lastModified: Date }> } = {};

    // Group files by their proposed base names to identify duplicates
    for (const [originalFile, proposedName] of Object.entries(validIpynbFiles)) {
        // Extract just the core base name, ignoring any (number) suffixes
        const coreBaseName = proposedName.replace(/\(\d+\)$/, '');

        // Only track base names that might have duplicates
        if (duplicates.has(coreBaseName)) {
            if (!duplicateGroups[coreBaseName]) {
                duplicateGroups[coreBaseName] = [];
                // Initialize the duplicateFiles entry for this regNo
                duplicateFiles[coreBaseName] = [];
            }

            // Get the file's last modified date
            const fileStat = await stat(path.join(currentDirectory, originalFile));
            const lastModified = fileStat.mtime;

            duplicateGroups[coreBaseName].push({
                originalFile,
                lastModified
            });

            // Also add to our new duplicateFiles structure with isSelected defaulting to false
            if (!duplicateFiles[coreBaseName]) {
                duplicateFiles[coreBaseName] = [];
            }
            duplicateFiles[coreBaseName].push({
                originalFilename: originalFile,
                isSelected: false, // Will be updated after user selection
                lastModified
            });
        }
    }

    // Prompt user to select which file to keep for each duplicate group
    for (const [regNo, files] of Object.entries(duplicateGroups)) {
        console.log(`\n${chalk.yellow.bold('Duplicate files found for base name:')} ${chalk.blue.bold(regNo)}`);

        const choices = files.map(file => ({
            name: `${file.originalFile} (Last modified: ${file.lastModified.toLocaleString()})`,
            value: file.originalFile
        }));

        const { selectedFile } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedFile',
                message: 'Which file would you like to keep?',
                choices
            }
        ]);            // Update fileMap to keep only the selected file with its original proposed name
        // Mark other files as ignored by removing them from fileMap
        const extractedRegNo = [...regNo.matchAll(/\d{2}[a-zA-Z]{3}\d{4}/g)][0]?.[0]?.toUpperCase() || regNo;

        for (const file of files) {
            const isSelected = file.originalFile === selectedFile;

            // Update the isSelected status in our duplicateFiles structure
            if (duplicateFiles[extractedRegNo]) {
                const fileInfo = duplicateFiles[extractedRegNo].find(f => f.originalFilename === file.originalFile);
                if (fileInfo) {
                    fileInfo.isSelected = isSelected;
                }
            }

            // Remove non-selected files from validIpynbFiles and add to invalidFiles
            if (!isSelected) {
                // Add to invalidFiles list with reason
                invalidFilesList.push({
                    filename: file.originalFile,
                    reason: InvalidFileReason.DUPLICATE,
                    details: `Duplicate of ${selectedFile}`,
                    duplicateOf: selectedFile,
                    lastModified: file.lastModified
                });

                // Remove from validIpynbFiles
                delete validIpynbFiles[file.originalFile];
            }
        }
    }    // Prepare the result with our updated structure
    const result: SanitizationResult = {
        totalFilesInDirectory: targetFiles.length,
        validFiles: validIpynbFiles,
        invalidFiles: invalidFilesList,
        fileExtension: fileExtension
    };

    // Display all files with highlighted register numbers just before the Analysis Summary
    console.log(`\n${chalk.cyan.underline('All files in directory:')}`);
    for (const file of initialFiles) {
        try {
            const fileStats = await stat(path.join(currentDirectory, file));
            const isDirectory = fileStats.isDirectory();
            const isDuplicate = invalidFilesList.some(invalidFile =>
                invalidFile.filename === file && invalidFile.reason === InvalidFileReason.DUPLICATE
            );

            if (isDirectory) {
                console.log(`${chalk.blue.bold('📁')} ${chalk.blue(file)}`);
            } else {
                // Extract register number pattern if exists
                const regPattern = /(\d{2}[a-zA-Z]{3}\d{4})/;
                const match = file.match(regPattern);

                // Check if file is .ipynb extension
                if (file.endsWith('.ipynb')) {
                    if (match) {
                        // IPYNB file with register number - highlight register number in bold
                        const beforeMatch = file.substring(0, match.index);
                        const afterMatch = file.substring(match.index! + match[0].length);

                        if (isDuplicate) {
                            // Highlight duplicates in purple
                            console.log(`${chalk.white('📄')} ${chalk.white(beforeMatch)}${chalk.magenta.bold(match[0])}${chalk.white(afterMatch)}`);
                        } else {
                            console.log(`${chalk.white('📄')} ${chalk.white(beforeMatch)}${chalk.bold(match[0])}${chalk.white(afterMatch)}`);
                        }
                    } else {
                        // IPYNB file without register number - highlight in bold red
                        console.log(`${chalk.white('📄')} ${chalk.red.bold(file)}`);
                    }
                } else {
                    // Not an .ipynb file - highlight in red
                    console.log(`${chalk.white('📄')} ${chalk.red.bold(file)}`);
                }
            }
        } catch (error) {
            console.log(`📄 ${file}`); // Fallback if stat fails
        }
    }

    console.log(`\n${chalk.red.bold('--- Analysis Summary ---')}`);
    console.log(`\nTotal ${chalk.red.bold(fileExtension)} files found: ${chalk.blue.bold(result.totalFilesInDirectory)}`);

    const unsanitizableCount = invalidFilesList.filter(f => f.reason === InvalidFileReason.UNSANITIZABLE).length;
    const duplicateCount = invalidFilesList.filter(f => f.reason === InvalidFileReason.DUPLICATE).length;

    console.log(`\nValid files: ${chalk.green.bold(Object.keys(validIpynbFiles).length)}`);
    console.log(`\nInvalid files: ${chalk.red.bold(invalidFilesList.length)}`);
    console.log(`   - Unsanitizable (no valid pattern found): ${chalk.red.bold(unsanitizableCount)}`);
    console.log(`   - Duplicates (removed): ${chalk.yellow.bold(duplicateCount)}`);

    if (unsanitizableCount > 0) {
        console.log("\nUnsanitizable files (kept original names):")

        invalidFilesList
            .filter(f => f.reason === InvalidFileReason.UNSANITIZABLE)
            .map(f => f.filename)
            .forEach(f => console.log(`\t- ${chalk.red(f)}`));
    }
    if (duplicateCount > 0) {
        console.log("\nDuplicate files (removed):");

        invalidFilesList
            .filter(f => f.reason === InvalidFileReason.DUPLICATE)
            .map(f => `${f.filename} (duplicate of ${f.duplicateOf})`)
            .forEach(f => console.log(`\t- ${chalk.red(f)}`));

        console.log(`\n\n`)
    }

    return result;
}