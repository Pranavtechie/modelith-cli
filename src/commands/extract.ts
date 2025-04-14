import { analyzeFilenames } from "@utils/sanitize-filenames";
import { type SanitizationResult, type NotebookMetadataObject, type NotebookMetricsSubset } from '@utils/types'; // Updated to use refactored type
import { generateFolderHash } from "@utils/folder-hash";
import { NotebookAnalyzer } from "@utils/NotebookAnalyzer";
import { db } from "@db/client";
import { Run, type NotebookMetadata, Student } from "@db/schema";
import { eq } from "drizzle-orm";
import { compareAstsInFolder } from "@utils/ast-comparison";
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, parse, resolve } from 'node:path';
import { randomUUIDv7 } from "bun";
import { Command } from "commander";
import { selectCohort } from "../utils/cohortUtils";
import chalk from 'chalk';

export const extract = new Command()
    .name("extract")
    .description("Extract metadata, metrics, and ASTs from Jupyter notebooks")
    .option("-f, --folder <folder>", "Folder containing Jupyter Notebooks", process.cwd())
    .option("-o, --output <output>", "Output directory for analysis results", "modelith-analysis")
    .action(async (options) => {
        const paths = {
            folder: resolve(options.folder),
            outputBase: resolve(options.output),
            astOutput: join(resolve(options.output), 'ast_files'),
            evaluationFile: join(resolve(options.output), 'evaluation.json'),
        };

        console.log(`Analyzing notebooks in: ${chalk.blue(paths.folder)}`);
        console.log(`Outputting results to: ${chalk.green(paths.outputBase)}\n\n`);

        try {
            const selectedCohort = await selectCohort();
            if (!selectedCohort?.cohortId) {
                console.log("No cohort selected or selection cancelled. Exiting.");
                return;
            }

            const cohortId = selectedCohort.cohortId;

            // Ensure output directories exist
            for (const dir of [paths.outputBase, paths.astOutput]) {
                if (!existsSync(dir)) {
                    await mkdir(dir, { recursive: true });
                    console.log(`Created directory: ${dir}`);
                }
            }

            // Validate input folder and get file mapping
            const analysisResult: SanitizationResult = await analyzeFilenames(paths.folder);
            if (analysisResult.totalFilesInDirectory === 0) {
                console.log("No .ipynb files found in the specified directory. Exiting.");
                return;
            }

            const runId = (await generateFolderHash(paths.folder)) ?? randomUUIDv7();
            console.log(`\nGenerated Run ID: ${runId}`);

            const evaluation = {};
            const notebookMetrics: NotebookMetadataObject[] = [];

            for (const [originalFilename, proposedFilename] of Object.entries(analysisResult.validFiles)) {
                const filePaths = {
                    original: join(paths.folder, originalFilename),
                    ast: join(paths.astOutput, `${parse(proposedFilename).name}.ast.json`),
                };

                const regNo = parse(proposedFilename).name;
                let studentId: string | null = null;

                try {
                    const student = await db.select({ id: Student.studentId })
                        .from(Student)
                        .where(eq(Student.regNo, regNo))
                        .limit(1);
                    studentId = student[0]?.id ?? null;
                } catch (error) {
                    console.error(`Error querying student for regNo ${regNo}: ${String(error)}`);
                }

                try {
                    const analyzer = new NotebookAnalyzer(filePaths.original);
                    const metrics = await analyzer.getMetrics();
                    const ast = analyzer.getAst();

                    notebookMetrics.push({
                        ...metrics,
                        filename: proposedFilename,
                        runId,
                        studentId
                    });

                    if (ast) await analyzer.saveAstToFile(paths.astOutput, proposedFilename);

                    evaluation[proposedFilename] = {
                        originalFilename,
                        status: 'processed',
                        metricsSummary: {
                            totalCells: metrics.totalCells,
                            codeCells: metrics.codeCells,
                            markdownCells: metrics.markdownCells,
                            errors: metrics.errorCellCount,
                        },
                        astPath: ast ? join('ast_files', `${parse(proposedFilename).name}.ast.json`) : null,
                        studentId,
                    };
                } catch (error) {
                    console.error(`Error processing ${originalFilename}: ${error.message}`);
                    evaluation[proposedFilename] = {
                        originalFilename,
                        status: 'error',
                        error: error.message,
                        studentId,
                    };
                }
            }

            console.log("Finished processing notebooks.");

            // Store Metrics in SQLite database
            if (notebookMetrics.length > 0) {
                try {
                    await db.insert(Run).values({
                        runId,
                        runHash: runId,
                        timestamp: new Date(),
                        notebookCount: analysisResult.totalFilesInDirectory,
                        cohortId,
                    }).onConflictDoNothing();

                    await db.insert(NotebookMetadata).values(notebookMetrics);
                    console.log(`Inserted ${notebookMetrics.length} notebook records into the database.`);
                } catch (error) {
                    console.error(`Database error: ${error.message}`);
                }
            }

            // Save evaluation summary
            await Bun.write(paths.evaluationFile, JSON.stringify(evaluation, null, 2));
            console.log(`Evaluation summary saved to: ${paths.evaluationFile}`);

            // Perform AST Comparison
            const processedCount = Object.values(evaluation).filter(v => v.status === 'processed').length;
            if (processedCount >= 2) {
                try {
                    await compareAstsInFolder(paths.astOutput, paths.outputBase, runId);
                    console.log(`AST comparison results saved in ${paths.outputBase}`);
                } catch (error) {
                    console.error(`AST comparison failed: ${error.message}`);
                }
            } else {
                console.log(`Skipping AST comparison: Only ${processedCount} notebook(s) processed successfully.`);
            }

            console.log("\nExtraction process completed.");
            return;

        } catch (error) {
            console.error(`\nAn error occurred during the extraction process: ${error.message}`);
            if (error.stack) console.error(error.stack);
        }
    });