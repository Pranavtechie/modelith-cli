import * as fs from 'fs';
import { join, basename } from 'path';
import * as d3 from 'd3';
import { JSDOM } from 'jsdom';
import svg2img from 'svg2img'; // Assuming svg2img types might need adjustment
import { Worker } from 'worker_threads'; // Import Worker
import os from 'os'; // Import os to get CPU count
import ora from 'ora';

// Define the AST Node structure (adjust based on your actual AST structure)
interface AstNode {
    type: string;
    text: string;
    startPosition?: { row: number; column: number };
    endPosition?: { row: number; column: number };
    children?: AstNode[];
}

interface ComparisonResult {
    file1: string;
    file2: string;
    editDistance: number;
    similarity: number;
}

/**
 * Loads ASTs from .ast.json files in a directory.
 * @param folderPath Path to the folder containing .ast.json files
 * @returns A Map where keys are filenames and values are AST roots.
 */
function loadAstsFromJson(folderPath: string): Map<string, AstNode> {
    const asts = new Map<string, AstNode>();
    try {
        const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.ast.json'));
        for (const file of files) {
            const filePath = join(folderPath, file);
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const ast = JSON.parse(content) as AstNode; // Assuming root is the node
                asts.set(file, ast);
            } catch (error) {
                // console.error(`Error reading or parsing AST file ${filePath}:`, error);
            }
        }
    } catch (error) {
        // console.error(`Error reading directory ${folderPath}:`, error);
    }
    return asts;
}

/**
 * Compares two AST nodes for equivalence
 * @param node1 First AST node (or undefined)
 * @param node2 Second AST node (or undefined)
 * @param ignoreVariableNames Whether to ignore variable name differences
 */
function areAstsEquivalent(node1: AstNode | undefined, node2: AstNode | undefined, ignoreVariableNames: boolean = false): boolean {
    // If either node is undefined, they are not equivalent unless both are
    if (!node1 || !node2) {
        return node1 === node2;
    }

    // Check if node types are different
    if (node1.type !== node2.type) {
        return false;
    }

    // Handle different node types
    switch (node1.type) {
        case 'identifier':
            return ignoreVariableNames || node1.text === node2.text;
        case 'string':
        case 'integer':
        case 'float':
        case 'comment':
            return node1.text === node2.text;
        case 'binary_operator':
            const commutativeOps = ['+', '*'];
            // Check if text exists before calling includes
            const isCommutative = node1.text && commutativeOps.some(op => node1.text.includes(op));
            const children1 = node1.children;
            const children2 = node2.children;

            if (isCommutative && children1?.length! >= 3 && children2?.length! >= 3) {
                // Add checks to ensure children arrays are defined here
                if (!children1 || !children2) {
                    // This case should technically not be reached due to the length check, but belts and suspenders
                    return false;
                }
                const child1_0 = children1[0];
                const child1_2 = children1[2];
                const child2_0 = children2[0];
                const child2_2 = children2[2];

                return (
                    (areAstsEquivalent(child1_0, child2_0, ignoreVariableNames) &&
                        areAstsEquivalent(child1_2, child2_2, ignoreVariableNames)) ||
                    (areAstsEquivalent(child1_0, child2_2, ignoreVariableNames) &&
                        areAstsEquivalent(child1_2, child2_0, ignoreVariableNames))
                );
            } else {
                // Fall through to default comparison for non-commutative or incomplete binary ops
                return compareChildrenEquivalence(children1, children2, ignoreVariableNames);
            }
        case 'function_definition':
            const name1 = node1.children?.find(c => c.type === 'identifier');
            const name2 = node2.children?.find(c => c.type === 'identifier');
            const params1 = node1.children?.find(c => c.type === 'parameters');
            const params2 = node2.children?.find(c => c.type === 'parameters');
            const body1 = node1.children?.find(c => c.type === 'block');
            const body2 = node2.children?.find(c => c.type === 'block');

            // Check names first (if not ignoring variables)
            if (!ignoreVariableNames && name1?.text !== name2?.text) {
                return false;
            }
            // Compare parameters and body
            return areAstsEquivalent(params1, params2, ignoreVariableNames) &&
                areAstsEquivalent(body1, body2, ignoreVariableNames);

        case 'return_statement':
            const returnValue1 = node1.children?.find(c => c.type !== 'return');
            const returnValue2 = node2.children?.find(c => c.type !== 'return');
            return areAstsEquivalent(returnValue1, returnValue2, ignoreVariableNames);

        default:
            // For other node types, compare children recursively
            return compareChildrenEquivalence(node1.children, node2.children, ignoreVariableNames);
    }
}

/** Helper function to compare children arrays for equivalence */
function compareChildrenEquivalence(children1: AstNode[] | undefined, children2: AstNode[] | undefined, ignoreVariableNames: boolean): boolean {
    if (children1?.length !== children2?.length) {
        return false; // Different number of children
    }
    // If both are undefined or empty, they are equivalent in terms of children
    if (!children1 || children1.length === 0) {
        return true;
    }
    // Iterate and compare each child
    for (let i = 0; i < children1.length; i++) {
        if (!areAstsEquivalent(children1[i], children2?.[i], ignoreVariableNames)) {
            return false;
        }
    }
    return true;
}


/**
 * Compares ASTs from .ast.json files in the given folder,
 * generates a plot, and stores results in a JSON file.
 * @param folderPath Path to the folder containing .ast.json files
 */
export async function compareAstsInFolder(folderPath: string): Promise<ComparisonResult[]> {
    // Use ora spinner for progress
    const spinner = ora(`Loading ASTs from: ${folderPath}`).start();
    const astMap = loadAstsFromJson(folderPath);
    const filenames = Array.from(astMap.keys()).sort(); // Sort filenames for consistent ordering
    const numAsts = filenames.length;

    spinner.text = `Found ${numAsts} AST files for comparison.`;

    if (numAsts < 2) {
        spinner.fail("Need at least two AST files for comparison.");
        return [];
    }

    // Initialize matrices
    const similarityScores: number[][] = Array(numAsts).fill(0).map(() => Array(numAsts).fill(0));
    const editDistances: number[][] = Array(numAsts).fill(0).map(() => Array(numAsts).fill(0));
    const results: ComparisonResult[] = [];

    // Set diagonal to identity values
    for (let i = 0; i < numAsts; i++) {
        similarityScores[i]![i] = 1; // Identity for similarity
        editDistances[i]![i] = 0;    // Distance to self is 0
    }

    // --- Parallel Comparison Setup ---
    spinner.text = "Preparing tasks for parallel AST comparison...";
    const tasks: { index1: number, index2: number, ast1String: string, ast2String: string }[] = [];
    const astStrings = filenames.map(fname => {
        const ast = astMap.get(fname);
        if (!ast) throw new Error(`AST not found for ${fname} during stringification`);
        return JSON.stringify(ast);
    });

    for (let i = 0; i < numAsts; i++) {
        for (let j = i + 1; j < numAsts; j++) {
            tasks.push({
                index1: i,
                index2: j,
                ast1String: astStrings[i]!,
                ast2String: astStrings[j]!
            });
        }
    }

    const numWorkers = Math.min(os.cpus().length, tasks.length); // Use available cores, but not more than tasks
    spinner.text = `Starting ${numWorkers} worker threads for ${tasks.length} comparison tasks...`;
    const workers: Worker[] = [];
    const workerPromises: Promise<void>[] = [];
    let tasksAssigned = 0;
    let tasksCompleted = 0;
    const totalTasks = tasks.length;

    // Determine worker script path for dev (TS) vs bundled (JS)
    const workerScriptUrl = (() => {
        const url = import.meta.url;
        const suffix = url.endsWith('.ts')
            ? './ast-worker.ts'
            : './utils/ast-worker.js';
        return new URL(suffix, url).href;
    })();

    // Buffer for errors and worker messages
    const workerErrors: string[] = [];

    for (let i = 0; i < numWorkers; i++) {
        const worker = new Worker(workerScriptUrl);
        workers.push(worker);

        const promise = new Promise<void>((resolve, reject) => {
            const assignTask = () => {
                if (tasksAssigned < totalTasks) {
                    const task = tasks[tasksAssigned++];
                    worker.postMessage(task);
                } else {
                    // No more tasks for this worker, signal completion
                    worker.terminate().then(() => resolve()).catch(reject);
                }
            };

            worker.on('message', (result: any) => { // Use 'any' for now, refine if needed
                // Buffer worker message instead of logging
                // workerMessages.push(`Worker ${i} processed task ${result.index1} - ${result.index2}`);
                tasksCompleted++;
                if (result.status === 'success') {
                    const { index1, index2, distance, similarity } = result;
                    editDistances[index1]![index2] = distance;
                    editDistances[index2]![index1] = distance; // Symmetric
                    similarityScores[index1]![index2] = similarity;
                    similarityScores[index2]![index1] = similarity; // Symmetric

                    results.push({
                        file1: filenames[index1]!,
                        file2: filenames[index2]!,
                        editDistance: distance,
                        similarity
                    });
                } else {
                    workerErrors.push(`Worker task error for indices (${result.index1}, ${result.index2}): ${result.error}`);
                    // Optionally handle errors differently, e.g., set distance/similarity to NaN
                }

                if (tasksCompleted % 10 === 0 || tasksCompleted === totalTasks) {
                    spinner.text = `Completed ${tasksCompleted} / ${totalTasks} tasks`;
                }

                assignTask(); // Assign next task to this worker
            });

            worker.on('error', (err) => {
                workerErrors.push(`Worker error (Worker ${i}): ${err}`);
                reject(err); // Reject the promise on worker error
            });

            worker.on('exit', (code) => {
                if (code !== 0) {
                    workerErrors.push(`Worker ${i} stopped with exit code ${code}`);
                }
                // If exit happens before promise resolution (e.g., error), ensure it rejects or resolves
                if (tasksAssigned >= totalTasks) resolve(); // Resolve if worker finished normally after all tasks
            });

            assignTask(); // Assign the first task
        });
        workerPromises.push(promise);
    }

    // Wait for all workers to finish
    try {
        await Promise.all(workerPromises);
        spinner.succeed("All worker tasks completed.");
    } catch (error) {
        spinner.fail("Error occurred during worker execution.");
        workerErrors.push(`Error occurred during worker execution: ${error}`);
        // Decide how to proceed: maybe exit, or try to continue with partial results?
        console.log("Attempting to proceed with potentially partial results...");
    }

    // Print any buffered errors after ora is done
    if (workerErrors.length > 0) {
        for (const errMsg of workerErrors) {
            console.error(errMsg);
        }
    }


    // Generate heatmap plot - using D3.js and convert SVG to PNG with canvas
    try {
        spinner.start("\nGenerating heatmap using D3.js");
        const cellSize = 20; // Smaller cells for potentially many files
        const maxLabelLength = 20; // Limit label length
        const margin = { top: 50, right: 50, bottom: 150, left: 150 }; // Increased margins for rotated labels
        const plotWidth = cellSize * numAsts;
        const plotHeight = cellSize * numAsts;
        const totalWidth = plotWidth + margin.left + margin.right;
        const totalHeight = plotHeight + margin.top + margin.bottom;

        const dom = new JSDOM('<!DOCTYPE html><body></body>');
        const body = d3.select(dom.window.document.body);
        const svg = body.append('svg')
            .attr('width', totalWidth)
            .attr('height', totalHeight)
            .append('g') // Group for margins
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const colorScale = d3.scaleSequential(d3.interpolateViridis)
            .domain([0, 1]); // Similarity domain is 0 to 1

        // Add cells with explicit types for parameters
        similarityScores.forEach((row: number[], i: number) => {
            row.forEach((value: number, j: number) => {
                svg.append('rect')
                    .attr('x', j * cellSize)
                    .attr('y', i * cellSize)
                    .attr('width', cellSize)
                    .attr('height', cellSize)
                    .attr('fill', colorScale(value))
                    .attr('stroke', '#eee') // Lighter stroke
                    .attr('stroke-width', 0.5);
            });
        });

        // Add labels
        const shortFilenames = filenames.map(f => {
            const base = basename(f || '', '.ast.json'); // Handle potential undefined filename
            return base.length > maxLabelLength ? base.substring(0, maxLabelLength) + '...' : base;
        });

        // X-axis labels
        svg.selectAll('.x-label')
            .data(shortFilenames)
            .enter()
            .append('text')
            .attr('class', 'x-label')
            .style('font-size', '8px')
            .attr('text-anchor', 'end') // Anchor at the end for rotation
            // Position at bottom, rotate around the end point
            .attr('transform', (d, i) => `translate(${i * cellSize + cellSize / 2}, ${plotHeight + 5}) rotate(-65)`)
            .text(d => d);

        // Y-axis labels
        svg.selectAll('.y-label')
            .data(shortFilenames)
            .enter()
            .append('text')
            .attr('class', 'y-label')
            .style('font-size', '8px')
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            // Position left of heatmap
            .attr('transform', (d, i) => `translate(-5, ${i * cellSize + cellSize / 2})`)
            .text(d => d);

        // Add a title
        svg.append("text")
            .attr("x", plotWidth / 2)
            .attr("y", 0 - (margin.top / 2))
            .attr("text-anchor", "middle")
            .style("font-size", "16px")
            .style("text-decoration", "underline")
            .text("AST Similarity Heatmap");

        // Serialize and save
        const svgElement = dom.window.document.querySelector('svg');
        if (!svgElement) {
            throw new Error("SVG element not found after D3 generation.");
        }
        const svgData = new dom.window.XMLSerializer().serializeToString(svgElement);

        spinner.text = "Converting SVG to PNG...";
        // Use 'as any' for format if type issues persist with svg2img
        svg2img(svgData, { format: 'png' as any }, (error, buffer) => {
            if (error) {
                spinner.fail(`Error converting SVG to PNG: ${error}`);
                return;
            }
            try {
                fs.writeFileSync('ast_similarity_heatmap.png', buffer);
                spinner.succeed("Heatmap saved as ast_similarity_heatmap.png");
            } catch (writeError) {
                spinner.fail(`Error writing PNG file: ${writeError}`);
            }
        });
    } catch (error) {
        spinner.fail(`Error generating plot with D3: ${error}`);
    }

    // Store results in a JSON file
    const resultsFilename = "ast_comparison_results.json";
    try {
        fs.writeFileSync(resultsFilename, JSON.stringify(results, null, 2));
        console.log(`AST comparison complete. Results stored in ${resultsFilename}`);
    } catch (error) {
        console.error(`Error writing results to file ${resultsFilename}: ${error}`);
    }

    return results;
}