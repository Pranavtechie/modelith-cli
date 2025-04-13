import { parentPort } from 'worker_threads'; // Bun uses worker_threads compatible API

// --- AST Node Structure (Copied from ast-comparison.ts) ---
interface AstNode {
    type: string;
    text: string;
    startPosition?: { row: number; column: number };
    endPosition?: { row: number; column: number };
    children?: AstNode[];
}

// --- Helper Functions (Copied or adapted from ast-comparison.ts) ---

/**
 * Counts the total number of nodes in an AST subtree.
 */
function countAstNodes(node: AstNode | undefined): number {
    if (!node) return 0;
    let count = 1;
    if (node.children) {
        for (const child of node.children) {
            count += countAstNodes(child);
        }
    }
    return count;
}

/**
 * Calculates a normalized similarity score (0 to 1).
 */
function calculateNormalizedSimilarity(editDistance: number, maxDistance: number): number {
    if (maxDistance <= 0) {
        return editDistance === 0 ? 1 : 0;
    }
    const similarity = 1 - (editDistance / maxDistance);
    return Math.max(0, Math.min(1, similarity));
}

// --- Zhang-Shasha Algorithm Implementation (Copied from ast-comparison.ts) ---

interface PostOrderNode {
    node: AstNode;
    index: number; // Post-order index (1-based)
    leftmostDescendantIndex: number; // Post-order index of the leftmost descendant
}

function getPostOrderNodes(root: AstNode | undefined): PostOrderNode[] {
    const postOrderList: PostOrderNode[] = [];
    let index = 0;

    function traverse(node: AstNode | undefined): number {
        if (!node) return 0;

        let leftmostDescendantIndex = Infinity;

        if (node.children && node.children.length > 0) {
            for (const child of node.children) {
                const childLeftmost = traverse(child);
                if (childLeftmost !== 0) {
                    leftmostDescendantIndex = Math.min(leftmostDescendantIndex, childLeftmost);
                }
            }
        } else {
            leftmostDescendantIndex = index + 1;
        }

        index++;
        const currentNodeIndex = index;

        if (leftmostDescendantIndex === Infinity || leftmostDescendantIndex > currentNodeIndex) {
            leftmostDescendantIndex = currentNodeIndex;
        }

        postOrderList.push({
            node: node,
            index: currentNodeIndex,
            leftmostDescendantIndex: leftmostDescendantIndex
        });

        return leftmostDescendantIndex;
    }

    traverse(root);
    return postOrderList;
}

function tedCost(node1: AstNode | undefined, node2: AstNode | undefined): number {
    const DELETE_COST = 1;
    const INSERT_COST = 1;
    const SUBSTITUTE_COST = 1;
    const MATCH_COST = 0;

    if (node1 === undefined && node2 === undefined) return 0;
    if (node1 === undefined) return INSERT_COST;
    if (node2 === undefined) return DELETE_COST;

    if (node1.type !== node2.type) {
        return SUBSTITUTE_COST;
    }

    switch (node1.type) {
        case 'identifier':
        case 'string':
        case 'integer':
        case 'float':
        case 'comment':
            return node1.text === node2.text ? MATCH_COST : SUBSTITUTE_COST;
        default:
            return MATCH_COST;
    }
}

function calculateTreeEditDistance(node1: AstNode | undefined, node2: AstNode | undefined): number {
    if (!node1 && !node2) return 0;
    if (!node1) return countAstNodes(node2);
    if (!node2) return countAstNodes(node1);

    const postOrder1 = getPostOrderNodes(node1);
    const postOrder2 = getPostOrderNodes(node2);

    const n = postOrder1.length;
    const m = postOrder2.length;

    if (n === 0 && m === 0) return 0;
    if (n === 0) return m;
    if (m === 0) return n;

    type Row = number[];
    const treeDist: Row[] = Array(n + 1).fill(0).map(() => Array(m + 1).fill(0));

    for (let i = 1; i <= n; i++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        treeDist[i]![0] = treeDist[i - 1]![0] + tedCost(postOrder1[i - 1]!.node, undefined);
    }
    for (let j = 1; j <= m; j++) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        treeDist[0]![j] = treeDist[0]![j - 1]! + tedCost(undefined, postOrder2[j - 1]!.node);
    }

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const l1 = postOrder1[i - 1]!.leftmostDescendantIndex;
            const l2 = postOrder2[j - 1]!.leftmostDescendantIndex;

            const rowDel = treeDist[i - 1]!;
            const costDel = rowDel[j]! + tedCost(postOrder1[i - 1]!.node, undefined);

            const rowIns = treeDist[i]!;
            const costIns = rowIns[j - 1]! + tedCost(undefined, postOrder2[j - 1]!.node);

            const tempFD: number[][] = Array(i - l1 + 1).fill(0).map(() => Array(j - l2 + 1).fill(0));

            for (let x = l1; x <= i - 1; x++) {
                const xPrime = x - (l1 - 1);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                tempFD[xPrime]![0] = tempFD[xPrime - 1]![0]! + tedCost(postOrder1[x - 1]!.node, undefined);
            }
            for (let y = l2; y <= j - 1; y++) {
                const yPrime = y - (l2 - 1);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                tempFD[0]![yPrime] = tempFD[0]![yPrime - 1]! + tedCost(undefined, postOrder2[y - 1]!.node);
            }

            for (let x = l1; x <= i - 1; x++) {
                for (let y = l2; y <= j - 1; y++) {
                    const xPrime = x - (l1 - 1);
                    const yPrime = y - (l2 - 1);

                    const lx = postOrder1[x - 1]!.leftmostDescendantIndex;
                    const ly = postOrder2[y - 1]!.leftmostDescendantIndex;
                    const lxPrimeOffset = lx - (l1 - 1);
                    const lyPrimeOffset = ly - (l2 - 1);

                    const fdCostDel = tempFD[xPrime - 1]![yPrime]! + tedCost(postOrder1[x - 1]!.node, undefined);
                    const fdCostIns = tempFD[xPrime]![yPrime - 1]! + tedCost(undefined, postOrder2[y - 1]!.node);
                    const fdCostMatch = tempFD[lxPrimeOffset - 1]![lyPrimeOffset - 1]! + treeDist[x]![y]!;
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    tempFD[xPrime]![yPrime] = Math.min(fdCostDel, fdCostIns, fdCostMatch);
                }
            }
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const forestDistanceResult = tempFD[i - l1]![j - l2]!;

            const substitutionCostNode = tedCost(postOrder1[i - 1]!.node, postOrder2[j - 1]!.node);

            const rowSub = treeDist[l1 - 1]!;
            const subBaseCost = rowSub[l2 - 1]!;

            const currentRow = treeDist[i]!;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            currentRow[j] = Math.min(
                costDel,
                costIns,
                subBaseCost + forestDistanceResult + substitutionCostNode
            );
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return treeDist[n]![m]!;
}

// --- Worker Logic ---
if (!parentPort) {
    throw new Error('This script must be run as a worker thread.');
}

interface WorkerTask {
    index1: number;
    index2: number;
    ast1String: string;
    ast2String: string;
}

interface WorkerResultSuccess {
    status: 'success';
    index1: number;
    index2: number;
    distance: number;
    similarity: number;
}

interface WorkerResultError {
    status: 'error';
    index1: number;
    index2: number;
    error: string;
}

type WorkerResult = WorkerResultSuccess | WorkerResultError;

parentPort.on('message', (task: WorkerTask) => {
    const { index1, index2, ast1String, ast2String } = task;

    try {
        const ast1: AstNode = JSON.parse(ast1String);
        const ast2: AstNode = JSON.parse(ast2String);

        const distance = calculateTreeEditDistance(ast1, ast2);
        const maxPossibleDistance = countAstNodes(ast1) + countAstNodes(ast2);
        const similarity = calculateNormalizedSimilarity(distance, maxPossibleDistance);

        parentPort!.postMessage({
            status: 'success',
            index1,
            index2,
            distance,
            similarity
        } as WorkerResultSuccess);
    } catch (error) {
        parentPort!.postMessage({
            status: 'error',
            index1,
            index2,
            error: error instanceof Error ? error.message : String(error)
        } as WorkerResultError);
    }
});

// Optional: Add console log to confirm worker start
// console.log(`AST Worker thread started.`);
