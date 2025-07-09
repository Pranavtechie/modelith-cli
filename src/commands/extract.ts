import { paths } from "@/utils/config";
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
    .action(async (options) => {
        // Generate runId early for namespacing
        const runId = (await generateFolderHash(resolve(options.input))) ?? randomUUIDv7();
        const pathsOut = {
            folder: resolve(options.input),
            dataBase: paths.data,
            runBase: join(paths.data, "data", runId),
            astOutput: join(paths.data, "data", runId, "ast"),
            sourceCodeOutput: join(paths.data, "data", runId, "source-code"),
        };

        console.log(`Analyzing notebooks in: ${chalk.blue(pathsOut.folder)}`);
        console.log(`Outputting results to: ${chalk.green(pathsOut.runBase)}\n\n`);

        try {
            const selectedCohort = await selectCohort();
            if (!selectedCohort?.cohortId) {
                console.log("No cohort selected or selection cancelled. Exiting.");
                return;
            }

            const cohortId = selectedCohort.cohortId;

            // Query all students in the cohort and build regNo -> studentId map
            let regNoToStudentId: Record<string, string> = {};
            try {
                const students = await db.select({ regNo: Student.regNo, studentId: Student.studentId })
                    .from(Student)
                    .where(eq(Student.cohortId, cohortId));
                regNoToStudentId = students.reduce((acc, s) => {
                    if (s.regNo && s.studentId) acc[s.regNo] = s.studentId;
                    return acc;
                }, {} as Record<string, string>);
            } catch (err) {
                console.error('Error fetching students for cohort:', err);
                return;
            }

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
            for (const dir of [pathsOut.dataBase, pathsOut.runBase, pathsOut.astOutput, pathsOut.sourceCodeOutput]) {
                if (!existsSync(dir)) {
                    await mkdir(dir, { recursive: true });
                    console.log(`Created directory: ${dir}`);
                }
            }

            // Validate input folder and get file mapping
            const analysisResult: SanitizationResult = await analyzeFilenames(pathsOut.folder);
            if (analysisResult.totalFilesInDirectory === 0) {
                console.log("No .ipynb files found in the specified directory. Exiting.");
                return;
            }

            const notebookMetrics: NotebookMetadataObject[] = [];

            for (const [originalFilename, regNo] of Object.entries(analysisResult.validFiles)) {
                const studentId = regNoToStudentId[regNo];
                if (!studentId) {
                    console.error(`No studentId found for regNo ${regNo}, skipping file ${originalFilename}`);
                    continue;
                }
                const filePaths = {
                    original: join(pathsOut.folder, originalFilename),
                    ast: join(pathsOut.astOutput, `${studentId}.ast.json`),
                    source: join(pathsOut.sourceCodeOutput, `${studentId}.ipynb`),
                };

                // Copy the .ipynb file to the new source-code folder
                try {
                    await Bun.write(filePaths.source, await Bun.file(filePaths.original).arrayBuffer());
                } catch (copyError) {
                    console.error(`Error copying ${originalFilename} to source-code folder: ${String(copyError)}`);
                }

                try {
                    const analyzer = new NotebookAnalyzer(filePaths.original);
                    const metrics = await analyzer.getMetrics();
                    const ast = analyzer.getAst();

                    // Store the relative path from paths.data to the copied .ipynb file
                    const relativeSourcePath = join(runId, "source-code", `${studentId}.ipynb`);

                    notebookMetrics.push({
                        ...metrics,
                        filename: relativeSourcePath,
                        runId,
                        studentId,
                    });

                    if (ast) await analyzer.saveAstToFile(pathsOut.astOutput, studentId);

                } catch (error) {
                    const errMsg = (typeof error === 'object' && error && 'message' in error) ? (error as any).message : String(error);
                    console.error(`Error processing ${originalFilename}: ${errMsg}`);
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
                    const errMsg = (typeof error === 'object' && error && 'message' in error) ? (error as any).message : String(error);
                    console.error(`Database error: ${errMsg}`);
                }
            }

            // Perform AST Comparison
            const processedCount = notebookMetrics.length;
            if (processedCount >= 2) {
                try {
                    const similarityResults = await compareAstsInFolder(pathsOut.astOutput);
                    if (similarityResults && similarityResults.length > 0) {
                        // Map studentId to studentId for quick lookup (identity)
                        const similarityRows = similarityResults
                            .map(({ file1, file2, editDistance, similarity }) => {
                                const studentA = file1.replace(/\.ast\.json$/, '');
                                const studentB = file2.replace(/\.ast\.json$/, '');
                                return {
                                    runId,
                                    studentA,
                                    studentB,
                                    similarityScore: similarity,
                                    treeEditDistance: editDistance
                                };
                            })
                            .filter(row => row.studentA && row.studentB && row.studentA !== row.studentB)
                            .map(row => ({ ...row, studentA: row.studentA as string, studentB: row.studentB as string }));
                        try {
                            if (similarityRows.length > 0) {
                                await db.insert(Similarity).values(similarityRows);
                                console.log(`Inserted ${similarityRows.length} similarity records into the database.`);
                            } else {
                                console.log('No valid similarity records to insert.');
                            }
                        } catch (dbError) {
                            const errMsg = (typeof dbError === 'object' && dbError && 'message' in dbError) ? (dbError as any).message : String(dbError);
                            console.error(`Database error inserting similarity results: ${errMsg}`);
                        }
                    }
                    console.log(`AST comparison results saved in ${pathsOut.runBase}`);
                } catch (error) {
                    const errMsg = (typeof error === 'object' && error && 'message' in error) ? (error as any).message : String(error);
                    console.error(`AST comparison failed: ${errMsg}`);
                }
            } else {
                console.log(`Skipping AST comparison: Only ${processedCount} notebook(s) processed successfully.`);
            }

            console.log("\nExtraction process completed.");
            process.exit(0)

        } catch (error) {
            const errMsg = (typeof error === 'object' && error && 'message' in error) ? (error as any).message : String(error);
            console.error(`\nAn error occurred during the extraction process: ${errMsg}`);
            if (error && typeof error === 'object' && 'stack' in error) console.error((error as any).stack);
        }
    });