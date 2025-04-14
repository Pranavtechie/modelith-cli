import { analyzeFilenames } from "@utils/sanitize-filenames"; // STEP 1
import { type SanitizationResult } from '@utils/types';
import { generateFolderHash } from "@utils/folder-hash"; // STEP 2
import { NotebookAnalyzer } from "@utils/NotebookAnalyzer"; // STEP 5
import { db } from "@db/client"; // STEP 6
import { Run, NotebookMetadata, Similarity, Student } from "@db/schema"; // STEP 6 & 8 & Student lookup
import { eq } from "drizzle-orm"; // For DB queries
import { compareAstsInFolder } from "@utils/ast-comparison"; // STEP 8
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, parse, resolve } from 'node:path'; // Import parse and resolve
import { randomUUIDv7 } from "bun"; // For Run ID if hash fails
import { Command } from "commander";
import path from 'path'; // Import path for resolve
import { selectCohort } from "../utils/cohortUtils";
import chalk from 'chalk'

// Helper function to ensure data is JSON-compatible for DB blob fields
function ensureJsonCompatible(data: any): string | null {
    if (data === undefined || data === null) {
        return null;
    }
    try {
        // Attempt to stringify complex objects/arrays
        return JSON.stringify(data);
    } catch (e) {
        console.warn("Could not stringify data for DB storage:", data);
        return null;
    }
}

export const extract = new Command()
    .name("extract")
    .description("Extract metadata, metrics, and ASTs from Jupyter notebooks")
    .option("-f, --folder <folder>", "Folder containing Jupyter Notebooks", process.cwd()) // Default to cwd
    .option("-o, --output <output>", "Output directory for analysis results", "modelith-analysis") // Default output dir
    .action(async (options) => {
        const { folder, output } = options;
        const folderPath = resolve(folder);
        const outputBasePath = resolve(output);
        const astOutputDir = join(outputBasePath, 'ast_files'); // Specific dir for ASTs
        const evaluationFilePath = join(outputBasePath, 'evaluation.json');
        // AST comparison outputs are handled within compareAstsInFolder

        console.log(`Analyzing notebooks in: ${chalk.blue(folderPath)}`);
        console.log(`Outputting results to: ${chalk.green(outputBasePath)}\n\n`);

        let selectedCohortId: string | null = null; // Define selectedCohortId

        try {
            // Select the cohort
            const selectedCohort = await selectCohort();
            if (!selectedCohort || !selectedCohort.cohortId) {
                console.log("No cohort selected or selection cancelled. Exiting.");
                return;
            }
            selectedCohortId = selectedCohort.cohortId;

            // STEP 4: Ensure output directories exist
            if (!existsSync(outputBasePath)) {
                await mkdir(outputBasePath, { recursive: true });
                console.log(`Created output directory: ${outputBasePath}`);
            }
            if (!existsSync(astOutputDir)) {
                await mkdir(astOutputDir, { recursive: true });
                console.log(`Created AST output directory: ${astOutputDir}`);
            }

            // STEP 1: Validate input folder and get file mapping
            const analysisResult: SanitizationResult = await analyzeFilenames(folderPath);
            if (analysisResult.totalFilesInDirectory === 0) {
                console.log("No .ipynb files found in the specified directory. Exiting.");
                return;
            }


            return null;

            // STEP 2: Generate hash for the folder
            const folderHash = await generateFolderHash(folderPath);
            const runId = folderHash ?? randomUUIDv7(); // Use hash or fallback to UUID
            console.log(`Generated Run ID: ${runId}`);

            // STEP 3 & 5: Initialize evaluation dictionary and process notebooks
            console.log("Step 3 & 5: Processing notebooks, generating metrics and ASTs...");
            const evaluationDictionary: Record<string, any> = {};
            const allNotebookMetrics: any[] = []; // To store metrics for DB insertion

            for (const originalFilename in analysisResult.validIpynbFiles) {
                const proposedFilename = analysisResult.validIpynbFiles[originalFilename]
                const originalFilePath = join(folderPath, originalFilename);
                const proposedBaseName = parse(proposedFilename).name; // Use parse from node:path
                const astFilePath = join(astOutputDir, `${proposedBaseName}.ast.json`);

                console.log(`Processing: ${originalFilename} -> ${proposedFilename}`);

                // Extract registration number from proposed filename (assuming format like '22bce1010.ipynb')
                const regNoMatch = proposedBaseName.match(/^(\d{2}[a-zA-Z]{3}\d{4})/);
                const regNo = regNoMatch ? regNoMatch[1] : null;
                let studentId: string | null = null;

                if (regNo) {
                    try {
                        const studentResult = await db.select({ id: Student.studentId })
                            .from(Student)
                            .where(eq(Student.regNo, regNo))
                            .limit(1)
                        if (studentResult.length > 0) {
                            studentId = studentResult[0].id;
                            console.log(`Found studentId: ${studentId} for regNo: ${regNo}`);
                        } else {
                            console.warn(`No student found for regNo: ${regNo} extracted from ${proposedFilename}`);
                        }
                    } catch (dbError: any) {
                        console.error(`Error querying student for regNo ${regNo}: ${dbError.message}`);
                    }
                } else {
                    console.warn(`Could not extract valid registration number from ${proposedFilename}`);
                }

                try {
                    const analyzer = new NotebookAnalyzer(originalFilePath);
                    const metrics = await analyzer.getMetrics(); // Ensure metrics are awaited
                    const ast = analyzer.getAst();

                    // Store metrics for DB, including the found studentId
                    allNotebookMetrics.push({
                        ...metrics,
                        filename: proposedFilename, // Use the proposed filename
                        runId: runId,
                        studentId: studentId, // Add the fetched studentId
                        cohortId: selectedCohortId, // Add the cohort ID
                    });

                    // Save AST (using analyzer's method)
                    if (ast) { // Only save if AST was generated
                        await analyzer.saveAstToFile(astOutputDir, proposedFilename);
                    } else {
                        console.warn(`AST not generated for ${originalFilename}, skipping save.`);
                    }


                    // Update evaluation dictionary
                    evaluationDictionary[proposedFilename] = {
                        originalFilename: originalFilename,
                        status: 'processed',
                        metricsSummary: {
                            totalCells: metrics.totalCells,
                            codeCells: metrics.codeCells,
                            markdownCells: metrics.markdownCells,
                            errors: metrics.errorCellCount,
                        },
                        // Use relative path for astPath in evaluation for portability
                        astPath: ast ? path.relative(outputBasePath, join(astOutputDir, `${proposedBaseName}.ast.json`)) : null,
                        studentId: studentId, // Also add studentId here for reference
                    };

                } catch (error: any) {
                    console.error(`Error processing ${originalFilename}: ${error.message}`);
                    evaluationDictionary[proposedFilename] = {
                        originalFilename: originalFilename,
                        status: 'error',
                        error: error.message,
                        studentId: studentId, // Include studentId even on error if found
                    };
                }
            }
            console.log("Finished processing notebooks.");

            // STEP 6: Store Metrics in SQLite database
            console.log("Step 6: Storing results in database...");
            if (allNotebookMetrics.length > 0) {
                try {
                    // Create Run record
                    await db.insert(Run).values({
                        runId: runId,
                        runHash: folderHash,
                        timestamp: new Date(),
                        notebookCount: analysisResult.metadata.totalFiles,
                        cohortId: selectedCohortId, // Store the cohort ID
                    }).onConflictDoNothing();

                    // Prepare and insert NotebookMetadata records
                    const metadataToInsert = allNotebookMetrics.map(m => ({
                        notebookId: randomUUIDv7(),
                        runId: m.runId,
                        filename: m.filename,
                        totalCells: m.totalCells,
                        codeCells: m.codeCells,
                        markdownCells: m.markdownCells,
                        cellExecutionCount: ensureJsonCompatible(m.cellExecutionCount),
                        magicCommandUsage: m.magicCommandUsage,
                        outputCellsCount: m.outputCellsCount,
                        errorCellCount: m.errorCellCount,
                        codeReusabilityMetric: m.codeReusabilityMetric,
                        codeVsMarkdownRatio: m.codeVsMarkdownRatio,
                        totalLinesOfCode: m.totalLinesOfCode,
                        totalLinesInMarkdown: m.totalLinesInMarkdown,
                        uniqueImports: m.uniqueImports,
                        totalExecutionTime: m.totalExecutionTime,
                        executionTimeDeltaPerCell: ensureJsonCompatible(m.executionTimeDeltaPerCell),
                        linkCount: m.linkCount,
                        widgetUsage: m.widgetUsage,
                        executionOrderDisorder: m.executionOrderDisorder,
                        astNodeCount: m.astNodeCount,
                        astDepth: m.astDepth,
                        functionDefinitionsCount: m.functionDefinitionsCount,
                        classDefinitionsCount: m.classDefinitionsCount,
                        numberOfFunctionCalls: m.numberOfFunctionCalls,
                        numberOfLoopConstructs: m.numberOfLoopConstructs,
                        numberOfConditionalStatements: m.numberOfConditionalStatements,
                        numberOfVariableAssignments: m.numberOfVariableAssignments,
                        estimatedCyclomaticComplexity: m.estimatedCyclomaticComplexity,
                        exceptionHandlingBlocksCount: m.exceptionHandlingBlocksCount,
                        recursionDetectionStatus: m.recursionDetectionStatus,
                        comprehensionCount: m.comprehensionCount,
                        binaryOperationCount: m.binaryOperationCount,
                        meanIdentifierLength: m.meanIdentifierLength,
                        keywordDensity: m.keywordDensity,
                        metadataJson: ensureJsonCompatible(m.metadataJson),
                        ipynbOrigin: m.ipynbOrigin,
                        studentId: m.studentId, // Include the studentId in the insertion data
                        cohortId: selectedCohortId, // Include the cohort ID
                    }));

                    await db.insert(NotebookMetadata).values(metadataToInsert);
                    console.log(`Successfully inserted ${metadataToInsert.length} notebook records into the database.`);

                } catch (error: any) {
                    console.error(`Database error: ${error.message}`);
                }
            } else {
                console.log("No metrics collected, skipping database insertion.");
            }

            // STEP 7: Store evaluation dictionary
            console.log("Step 7: Saving evaluation summary...");
            await Bun.write(evaluationFilePath, JSON.stringify(evaluationDictionary, null, 2));
            console.log(`Evaluation summary saved to: ${evaluationFilePath}`);

            // STEP 8: Perform AST Comparison
            console.log("Step 8: Performing AST comparison...");
            const processedFilesCount = Object.values(evaluationDictionary).filter(v => v.status === 'processed').length;
            if (processedFilesCount >= 2) {
                try {
                    await compareAstsInFolder(
                        astOutputDir,
                        outputBasePath,
                        runId
                    );
                    console.log(`AST comparison results saved in ${outputBasePath}`);
                } catch (error: any) {
                    console.error(`AST comparison failed: ${error.message}`);
                }
            } else {
                console.log(`Skipping AST comparison: Only ${processedFilesCount} notebook(s) processed successfully (requires at least 2).`);
            }

            console.log("\nExtraction process completed.");

        } catch (error: any) {
            console.error(`\nAn error occurred during the extraction process: ${error.message}`);
            if (error.stack) {
                console.error(error.stack);
            }
        }
    });