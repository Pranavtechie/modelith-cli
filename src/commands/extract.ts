import { db } from "@db/client";
import { NotebookMetadata, Run, Similarity, Student } from "@db/schema";
import { compareAstsInFolder } from "@utils/ast-comparison";
import { generateFolderHash } from "@utils/folder-hash";
import { NotebookAnalyzer } from "@utils/NotebookAnalyzer";
import { analyzeFilenames } from "@utils/sanitize-filenames";
import { type NotebookMetadataObject, type SanitizationResult } from '@utils/types'; // Updated to use refactored type
import { randomUUIDv7 } from "bun";
import chalk from 'chalk';
import { Command } from "commander";
import { eq } from "drizzle-orm";
import inquirer from 'inquirer';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { selectCohort } from "../utils/cohortUtils";

export const extract = new Command()
    .name("extract")
    .description("Extract metadata, metrics, and ASTs from Jupyter notebooks")
    .option("-i, --input <input>", "Folder containing Jupyter Notebooks", process.cwd())
    .option("-o, --output <output>", "Output directory for analysis results", "modelith-analysis")
    .action(async (options) => {
        const paths = {
            folder: resolve(options.input),
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

            // Prompt user for a unique run name for this cohort
            let runName: string | undefined;
            let existingNames: string[] = [];
            try {
                // Fetch all run names for this cohort
                const runs = await db.select({ name: Run.name }).from(Run).where(eq(Run.cohortId, cohortId));
                existingNames = runs.map(r => r.name).filter(Boolean);
            } catch (err) {
                console.error('Error fetching existing run names:', err);
            }
            while (!runName) {
                const { value } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'value',
                        message: 'Enter a unique name for this run:',
                        validate: (input: string) => {
                            if (!input.trim()) return 'Run name cannot be empty.';
                            if (existingNames.includes(input.trim())) return 'Run name already exists in this cohort. Please enter a different name.';
                            return true;
                        },
                    },
                ]);
                if (!existingNames.includes(value.trim()) && value.trim()) {
                    runName = value.trim();
                }
            }

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

            const evaluation = {};
            const notebookMetrics: NotebookMetadataObject[] = [];

            for (const [originalFilename, regNo] of Object.entries(analysisResult.validFiles)) {
                const filePaths = {
                    original: join(paths.folder, originalFilename),
                    ast: join(paths.astOutput, `${regNo}.ast.json`),
                };

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
                        filename: regNo,
                        runId,
                        studentId
                    });

                    if (ast) await analyzer.saveAstToFile(paths.astOutput, regNo);

                    evaluation[regNo] = {
                        originalFilename,
                        status: 'processed',
                        metricsSummary: {
                            totalCells: metrics.totalCells,
                            codeCells: metrics.codeCells,
                            markdownCells: metrics.markdownCells,
                            errors: metrics.errorCellCount,
                        },
                        astPath: ast ? join('ast_files', `${regNo}.ast.json`) : null,
                        studentId,
                    };
                } catch (error) {
                    console.error(`Error processing ${originalFilename}: ${error.message}`);
                    evaluation[regNo] = {
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
                        name: runName,
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
                    const similarityResults = await compareAstsInFolder(paths.astOutput);
                    if (similarityResults && similarityResults.length > 0) {
                        // Map regNo to studentId for quick lookup
                        const regNoToStudentId = Object.entries(analysisResult.validFiles).reduce((acc, [orig, regNo]) => {
                            const sid = notebookMetrics.find(m => m.filename === regNo)?.studentId;
                            if (sid) acc[regNo] = sid;
                            return acc;
                        }, {} as Record<string, string>);
                        const similarityRows = similarityResults.map(({ file1, file2, editDistance, similarity }) => {
                            const studentA = regNoToStudentId[file1.replace(/\.ast\.json$/, '')] || null;
                            const studentB = regNoToStudentId[file2.replace(/\.ast\.json$/, '')] || null;
                            return {
                                runId,
                                studentA,
                                studentB,
                                similarityScore: similarity,
                                treeEditDistance: editDistance
                            };
                        }).filter(row => row.studentA && row.studentB);
                        try {
                            if (similarityRows.length > 0) {
                                await db.insert(Similarity).values(similarityRows);
                                console.log(`Inserted ${similarityRows.length} similarity records into the database.`);
                            } else {
                                console.log('No valid similarity records to insert.');
                            }
                        } catch (dbError) {
                            console.error(`Database error inserting similarity results: ${dbError.message}`);
                        }
                    }
                    console.log(`AST comparison results saved in ${paths.outputBase}`);
                } catch (error) {
                    console.error(`AST comparison failed: ${String(error)}`);
                }
            } else {
                console.log(`Skipping AST comparison: Only ${processedCount} notebook(s) processed successfully.`);
            }

            console.log("\nExtraction process completed.");
            process.exit(0)


        } catch (error) {
            console.error(`\nAn error occurred during the extraction process: ${error.message}`);
            if (error.stack) console.error(error.stack);
        }
    });