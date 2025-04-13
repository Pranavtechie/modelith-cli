import { readFileSync } from 'fs';
import { exiftool, type Tags } from 'exiftool-vendored';
import Parser from 'tree-sitter';
import Python from 'tree-sitter-python';
import { mkdir } from 'node:fs/promises';
import { join, basename } from 'path';

interface Cell {
    cell_type: 'code' | 'markdown';
    source: string[];
    execution_count?: number | null;
    outputs?: Array<{ output_type: string;[key: string]: any }>;
}

interface Notebook {
    cells: Cell[];
    metadata: Record<string, any>;
}

export class NotebookAnalyzer {
    private notebookFile: string;
    private notebook: Notebook;
    private parser: Parser;
    private metrics: Record<string, any> = {};
    private tree: any;

    constructor(notebookFile: string) {
        this.notebookFile = notebookFile;
        try {
            const content = readFileSync(this.notebookFile, 'utf-8');
            this.notebook = JSON.parse(content) as Notebook;
        } catch (error) {
            console.error(`Error parsing notebook file: ${error}`);
            this.notebook = { cells: [], metadata: {} };
        }
        this.parser = new Parser();
        this.parser.setLanguage(Python);
        this.analyze(); // Initial analysis (sync parts + async kickoff)
    }

    private async extractMetadata(): Promise<Record<string, any>> {
        try {
            const tags: Tags = await exiftool.read(this.notebookFile);
            // Ensure the returned object is serializable JSON
            return JSON.parse(JSON.stringify(tags));
        } catch (error) {
            console.error(`Error extracting metadata: ${error}`);
            return {};
        }
    }

    private determineIpynbOrigin(): string {
        const metadata = this.notebook.metadata || {};
        if ('colab' in metadata) return 'google-colab';
        if ('kaggle' in metadata) return 'kaggle';
        return 'jupyter';
    }

    /**
     * Converts a tree-sitter node to a serializable object
     */
    private serializeNode(node: any): any {
        if (!node) return null;

        const result: any = {
            type: node.type,
            text: node.text,
            startPosition: node.startPosition,
            endPosition: node.endPosition,
            children: []
        };

        if (node.children && node.children.length) {
            result.children = node.children.map((child: any) => this.serializeNode(child));
        }

        return result;
    }

    private countNodes(node: any): number {
        let count = 1;
        if (node.children) {
            for (const child of node.children) {
                count += this.countNodes(child);
            }
        }
        return count;
    }

    private computeTreeDepth(node: any): number {
        if (!node.children || node.children.length === 0) return 1;
        return 1 + Math.max(...node.children.map((child: any) => this.computeTreeDepth(child)));
    }

    private countNodeTypes(node: any, types: string[]): number {
        let count = types.includes(node.type) ? 1 : 0;
        if (node.children) {
            for (const child of node.children) {
                count += this.countNodeTypes(child, types);
            }
        }
        return count;
    }

    private detectRecursion(tree: any): boolean {
        if (!tree) return false;
        const functionNames = new Set<string>();
        const collectFunctionNames = (node: any) => {
            if (!node) return;
            if (node.type === 'function_definition') {
                const nameNode = node.children?.find((child: any) => child.type === 'identifier');
                if (nameNode) functionNames.add(nameNode.text);
            }
            if (node.children) {
                for (const child of node.children) collectFunctionNames(child);
            }
        };
        collectFunctionNames(tree);

        const checkRecursion = (node: any, currentFunction: string | null): boolean => {
            if (!node) return false;
            if (node.type === 'function_definition') {
                const nameNode = node.children?.find((child: any) => child.type === 'identifier');
                currentFunction = nameNode ? nameNode.text : null;
            } else if (node.type === 'call') {
                const funcNode = node.children?.find((child: any) => child.type === 'identifier');
                if (funcNode && currentFunction && functionNames.has(currentFunction) && funcNode.text === currentFunction) return true;
            }
            if (node.children) {
                for (const child of node.children) {
                    if (checkRecursion(child, currentFunction)) return true;
                }
            }
            return false;
        };
        return checkRecursion(tree, null);
    }

    private collectIdentifiers(node: any): string[] {
        if (!node) return [];
        const pythonKeywords = new Set([
            'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class',
            'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
            'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
            'try', 'while', 'with', 'yield'
        ]);
        let identifiers: string[] = [];
        if (node.type === 'identifier' && !pythonKeywords.has(node.text)) {
            identifiers.push(node.text);
        }
        if (node.children) {
            for (const child of node.children) {
                identifiers = identifiers.concat(this.collectIdentifiers(child));
            }
        }
        return identifiers;
    }

    private countKeywords(code: string): number {
        const keywords = [
            'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await', 'break', 'class',
            'continue', 'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
            'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise', 'return',
            'try', 'while', 'with', 'yield'
        ];
        const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
        return (code.match(regex) || []).length;
    }

    private analyze(): void {
        const allCells = this.notebook.cells || [];
        const codeCells = allCells.filter(cell => cell.cell_type === 'code');
        const markdownCells = allCells.filter(cell => cell.cell_type === 'markdown');

        // Basic Notebook Stats - Use schema names
        this.metrics['filename'] = this.notebookFile; // Will be updated later in extract command
        this.metrics['totalCells'] = allCells.length;
        this.metrics['codeCells'] = codeCells.length;
        this.metrics['markdownCells'] = markdownCells.length;

        // Process Code Cells
        const codeSources: string[] = [];
        const cellExecutionCounts: (number | null)[] = [];
        let errorCellCount = 0;
        let magicUsage = 0;
        let outputCellsCount = 0;
        let duplicateCount = 0;
        const uniqueSources = new Set<string>();
        let totalCodeLines = 0;

        for (const cell of codeCells) {
            const source = cell.source.join('');
            codeSources.push(source);
            const lines = source.split('\n');
            totalCodeLines += lines.length;
            if (uniqueSources.has(source)) duplicateCount++;
            else uniqueSources.add(source);
            cellExecutionCounts.push(cell.execution_count ?? null);
            magicUsage += lines.filter(line => line.trim().startsWith('%')).length;
            const outputs = cell.outputs || [];
            outputCellsCount += outputs.length;
            errorCellCount += outputs.filter(out => out.output_type === 'error').length;
        }

        // Use schema names for metrics
        this.metrics['cellExecutionCount'] = cellExecutionCounts; // Will be JSON stringified later
        this.metrics['magicCommandUsage'] = magicUsage;
        this.metrics['outputCellsCount'] = outputCellsCount;
        this.metrics['errorCellCount'] = errorCellCount;
        this.metrics['codeReusabilityMetric'] = duplicateCount; // Assuming this maps to codeReusabilityMetric
        this.metrics['totalLinesOfCode'] = totalCodeLines;

        // Code vs Markdown Ratio
        const ratio = markdownCells.length > 0 ? codeCells.length / markdownCells.length : null;
        this.metrics['codeVsMarkdownRatio'] = ratio !== null ? Number(ratio.toFixed(2)) : null;

        // Total lines in markdown
        const totalMarkdownLines = markdownCells.reduce((sum, cell) => sum + cell.source.join('').split('\n').length, 0);
        this.metrics['totalLinesInMarkdown'] = totalMarkdownLines;

        // Unique Imports
        const importRegex = /^\s*(?:import|from)\s+([\w\.]+)/gm;
        const imports = new Set<string>();
        for (const source of codeSources) {
            let match;
            while ((match = importRegex.exec(source)) !== null) imports.add(match[1]);
        }
        this.metrics['uniqueImports'] = imports.size;

        // Execution Time Metrics (not available from static analysis)
        this.metrics['totalExecutionTime'] = null;
        this.metrics['executionTimeDeltaPerCell'] = []; // Will be JSON stringified later

        // Link Count in Markdown
        const linkPattern = /https?:\/\/\S+/g;
        const markdownText = markdownCells.map(cell => cell.source.join('')).join('\n');
        this.metrics['linkCount'] = (markdownText.match(linkPattern) || []).length;

        // Widget Usage
        const widgetPattern = /ipywidgets/g;
        this.metrics['widgetUsage'] = codeSources.reduce((count, source) => count + (source.match(widgetPattern) || []).length, 0);

        // Execution Order Disorder
        const execCounts = cellExecutionCounts.filter(count => count !== null) as number[];
        this.metrics['executionOrderDisorder'] = execCounts.length > 1 && execCounts.some((count, i) => i > 0 && count < execCounts[i - 1]);

        // AST Analysis
        const fullCode = codeSources.join('\n');
        try {
            this.tree = this.parser.parse(fullCode);
        } catch (error) {
            console.error(`Error parsing code with tree-sitter: ${error}`);
            this.tree = null;
        }

        if (this.tree && this.tree.rootNode) { // Check if rootNode exists
            const root = this.tree.rootNode;
            // Use schema names for AST metrics
            this.metrics['astNodeCount'] = this.countNodes(root);
            this.metrics['astDepth'] = this.computeTreeDepth(root);
            this.metrics['functionDefinitionsCount'] = this.countNodeTypes(root, ['function_definition']);
            this.metrics['classDefinitionsCount'] = this.countNodeTypes(root, ['class_definition']);
            this.metrics['numberOfFunctionCalls'] = this.countNodeTypes(root, ['call']);
            this.metrics['numberOfLoopConstructs'] = this.countNodeTypes(root, ['for_statement', 'while_statement']);
            this.metrics['numberOfConditionalStatements'] = this.countNodeTypes(root, ['if_statement']);
            this.metrics['numberOfVariableAssignments'] = this.countNodeTypes(root, ['assignment', 'augmented_assignment']);
            // Simple estimation for Cyclomatic Complexity
            this.metrics['estimatedCyclomaticComplexity'] = (
                this.metrics['numberOfConditionalStatements'] + this.metrics['numberOfLoopConstructs'] + 1 // Add 1 for the base path
            );
            this.metrics['exceptionHandlingBlocksCount'] = this.countNodeTypes(root, ['try_statement']);
            this.metrics['recursionDetectionStatus'] = this.detectRecursion(root);
            this.metrics['comprehensionCount'] = this.countNodeTypes(root, [
                'list_comprehension', 'dictionary_comprehension', 'set_comprehension', 'generator_expression'
            ]);
            this.metrics['binaryOperationCount'] = this.countNodeTypes(root, ['binary_operator']);

            const identifiers = this.collectIdentifiers(root);
            const meanIdentifierLength = identifiers.length > 0 ? identifiers.reduce((sum, id) => sum + id.length, 0) / identifiers.length : 0;
            this.metrics['meanIdentifierLength'] = Number(meanIdentifierLength.toFixed(2));

            const keywordCount = this.countKeywords(fullCode);
            const totalLines = fullCode.split('\n').length; // Use actual lines from joined code
            this.metrics['keywordDensity'] = totalLines > 0 ? Number((keywordCount / totalLines).toFixed(4)) : 0; // Increased precision
        } else {
            // Assign null to schema-based keys if AST parsing fails or rootNode is null
            this.metrics['astNodeCount'] = null;
            this.metrics['astDepth'] = null;
            this.metrics['functionDefinitionsCount'] = null;
            this.metrics['classDefinitionsCount'] = null;
            this.metrics['numberOfFunctionCalls'] = null;
            this.metrics['numberOfLoopConstructs'] = null;
            this.metrics['numberOfConditionalStatements'] = null;
            this.metrics['numberOfVariableAssignments'] = null;
            this.metrics['estimatedCyclomaticComplexity'] = null;
            this.metrics['exceptionHandlingBlocksCount'] = null;
            this.metrics['recursionDetectionStatus'] = null;
            this.metrics['comprehensionCount'] = null;
            this.metrics['binaryOperationCount'] = null;
            this.metrics['meanIdentifierLength'] = null;
            this.metrics['keywordDensity'] = null;
        }

        // Metadata and Origin are handled asynchronously in getMetrics
        this.metrics['metadataJson'] = null; // Placeholder
        this.metrics['ipynbOrigin'] = null; // Placeholder
    }

    public async getMetrics(): Promise<Record<string, any>> {
        // Ensure async operations complete before returning
        // Use Promise.allSettled to avoid failure if one promise rejects
        const results = await Promise.allSettled([
            this.extractMetadata(),
            Promise.resolve(this.determineIpynbOrigin()) // Wrap sync call for consistency
        ]);

        if (results[0].status === 'fulfilled') {
            this.metrics['metadataJson'] = results[0].value;
        } else {
            console.error("Failed to extract metadata:", results[0].reason);
            this.metrics['metadataJson'] = {}; // Assign default value on failure
        }

        if (results[1].status === 'fulfilled') {
            this.metrics['ipynbOrigin'] = results[1].value;
        } else {
            // This shouldn't fail as determineIpynbOrigin is sync, but handle defensively
            console.error("Failed to determine ipynb origin:", results[1].reason);
            this.metrics['ipynbOrigin'] = 'jupyter'; // Assign default value on failure
        }

        return this.metrics;
    }

    public getAst(): any {
        if (!this.tree || !this.tree.rootNode) return null;
        return this.serializeNode(this.tree.rootNode);
    }

    public toJson(): string {
        // Note: Call getMetrics first if you need the async parts populated
        return JSON.stringify(this.metrics, null, 2);
    }

    /**
     * Saves the AST to a JSON file in the specified directory
     * @param outputDir The directory to save the AST file in.
     * @param proposedFilename The filename (without extension) to use for the AST file.
     * @returns The path to the saved file or null if there was an error
     */
    public async saveAstToFile(outputDir: string, proposedFilename: string): Promise<string | null> {
        if (!this.tree || !this.tree.rootNode) {
            console.error(`No AST available to save for ${this.notebookFile}`);
            return null;
        }

        try {
            // Ensure the output directory exists (already handled in extract command, but good practice)
            await mkdir(outputDir, { recursive: true });

            const astBaseName = basename(proposedFilename, '.ipynb'); // Use the proposed name
            const outputPath = join(outputDir, `${astBaseName}.ast.json`);

            // Serialize the AST
            const serializedAst = this.serializeNode(this.tree.rootNode);
            const astJson = JSON.stringify(serializedAst, null, 2);

            // Write to file using Bun
            await Bun.write(outputPath, astJson);

            // console.log(`AST saved to ${outputPath}`); // Logging handled in extract command
            return outputPath;
        } catch (error) {
            console.error(`Error saving AST to file ${proposedFilename}.ast.json: ${error}`);
            return null;
        }
    }
}

// Cleanup ExifTool processes when done
// Ensure exiftool is properly terminated
let exiftoolEnded = false;
const endExiftool = () => {
    if (!exiftoolEnded) {
        exiftool.end().catch(err => console.error("Error ending exiftool:", err));
        exiftoolEnded = true;
    }
};

process.on('exit', endExiftool);
// Handle signals for graceful shutdown
process.on('SIGINT', () => { endExiftool(); process.exit(0); });
process.on('SIGTERM', () => { endExiftool(); process.exit(0); });