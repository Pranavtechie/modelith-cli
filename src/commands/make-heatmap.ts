import { Command } from "commander";
import inquirer from 'inquirer';
import { db } from '../db/client';
import { Run, Similarity, Student } from '../db/schema';
import ora from 'ora';
import * as d3 from 'd3';
import { JSDOM } from 'jsdom';
import svg2img from 'svg2img';
import fs from 'fs';
import { eq, inArray } from 'drizzle-orm';

export const makeHeatmap = new Command()
    .name("make-heatmap")
    .description("Creates a heatmap for the selected run and saves as an image")
    .option("-o, --output <output>", "output location of the heatmap", process.cwd())
    .action(async ({ output }) => {
        const spinner = ora('Fetching runs...').start();
        // 1. Query the DB for all run names
        const runs = await db.select({
            runId: Run.runId,
            name: Run.name
        }).from(Run);
        spinner.succeed('Runs fetched.');
        if (!runs.length) {
            console.error('No runs found.');
            return;
        }
        // 2. Prompt user to pick a run
        const { selectedRunId } = await inquirer.prompt([
            {
                type: 'list',
                name: 'selectedRunId',
                message: 'Select a run:',
                choices: runs.map(r => ({ name: r.name || r.runId, value: r.runId })),
            }
        ]);
        // 3. Query for similarity matrix for the selected run
        // spinner.start('Fetching similarity data...');
        // Fetch all similarity rows for the run
        const simRows = await db.select({
            studentA: Similarity.studentA,
            studentB: Similarity.studentB,
            similarityScore: Similarity.similarityScore
        })
            .from(Similarity)
            .where(eq(Similarity.runId, selectedRunId));
        if (!simRows.length) {
            spinner.fail('No similarity data for this run.');
            return;


        }
        // Get all unique student IDs from simRows
        const studentIds = Array.from(new Set([
            ...simRows.map(r => r.studentA),
            ...simRows.map(r => r.studentB)
        ]));
        // Fetch regNos for these students
        const students = await db.select({
            studentId: Student.studentId,
            regNo: Student.regNo
        }).from(Student).where(inArray(Student.studentId, studentIds));
        const idToRegNo: Record<string, string> = {};
        students.forEach(s => {
            if (typeof s.regNo === 'string') {
                idToRegNo[s.studentId] = s.regNo;
            }
        });
        // Build regNo list and matrix, filter missing/null regNos
        const regNos = Array.from(new Set([
            ...simRows.map(r => idToRegNo[r.studentA]),
            ...simRows.map(r => idToRegNo[r.studentB])
        ].filter(Boolean)));
        regNos.sort();
        const regNoIdx: Record<string, number> = Object.fromEntries(regNos.map((r, i) => [r, i]));
        const matrix = Array(regNos.length).fill(0).map(() => Array(regNos.length).fill(null));
        for (const row of simRows) {
            const regA = idToRegNo[row.studentA];
            const regB = idToRegNo[row.studentB];
            if (regA && regB) {
                const i = regNoIdx[regA];
                const j = regNoIdx[regB];
                if (i !== undefined && j !== undefined) {
                    matrix[i][j] = row.similarityScore;
                }
            }
        }

        console.log(matrix.length)
        console.log(matrix)
        // 4. Generate D3 heatmap
        // spinner.start('Generating heatmap...');
        const cellSize = 20;
        const margin = { top: 50, right: 50, bottom: 150, left: 150 };
        const plotWidth = cellSize * regNos.length;
        const plotHeight = cellSize * regNos.length;
        const totalWidth = plotWidth + margin.left + margin.right;
        const totalHeight = plotHeight + margin.top + margin.bottom;
        const dom = new JSDOM('<!DOCTYPE html><body></body>');
        const body = d3.select(dom.window.document.body);
        const svg = body.append('svg')
            .attr('width', totalWidth)
            .attr('height', totalHeight)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        const colorScale = d3.scaleSequential(d3.interpolateViridis)
            .domain([0, 1]);
        // Draw cells
        matrix.forEach((row, i) => {
            row.forEach((value, j) => {
                svg.append('rect')
                    .attr('x', j * cellSize)
                    .attr('y', i * cellSize)
                    .attr('width', cellSize)
                    .attr('height', cellSize)
                    .attr('fill', value !== null ? colorScale(value) : '#fff')
                    .attr('stroke', '#eee')
                    .attr('stroke-width', 0.5);
            });
        });
        // Add axis labels
        svg.selectAll('.x-label')
            .data(regNos)
            .enter()
            .append('text')
            .attr('class', 'x-label')
            .style('font-size', '8px')
            .attr('text-anchor', 'end')
            .attr('transform', (d, i) => `translate(${i * cellSize + cellSize / 2}, ${plotHeight + 5}) rotate(-65)`)
            .text(d => d);
        svg.selectAll('.y-label')
            .data(regNos)
            .enter()
            .append('text')
            .attr('class', 'y-label')
            .style('font-size', '8px')
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .attr('transform', (d, i) => `translate(-5, ${i * cellSize + cellSize / 2})`)
            .text(d => d);
        // Add legend
        const legendWidth = 200, legendHeight = 20;
        const legendSvg = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(0, ${plotHeight + 60})`);
        const legendScale = d3.scaleLinear().domain([0, 1]).range([0, legendWidth]);
        const legendAxis = d3.axisBottom(legendScale).ticks(5);
        // Gradient
        const defs = svg.append('defs');
        const linearGradient = defs.append('linearGradient')
            .attr('id', 'legend-gradient');
        linearGradient.selectAll('stop')
            .data(d3.range(0, 1.01, 0.01))
            .enter()
            .append('stop')
            .attr('offset', d => `${d * 100}%`)
            .attr('stop-color', d => colorScale(d));
        legendSvg.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .style('fill', 'url(#legend-gradient)');
        legendSvg.append('g')
            .attr('transform', `translate(0, ${legendHeight})`)
            .call(legendAxis);
        legendSvg.append('text')
            .attr('x', legendWidth / 2)
            .attr('y', legendHeight + 30)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Similarity Score');
        // Title
        svg.append('text')
            .attr('x', plotWidth / 2)
            .attr('y', 0 - (margin.top / 2))
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('text-decoration', 'underline')
            .text('Student Similarity Heatmap');
        // Prompt for output file name
        const { outputFileName } = await inquirer.prompt([
            {
                type: 'input',
                name: 'outputFileName',
                message: 'Enter output PNG file name (without extension):',
                default: 'student_similarity_heatmap'
            }
        ]);
        // Output SVG to PNG
        const svgElement = dom.window.document.querySelector('svg');
        if (!svgElement) {
            spinner.fail('SVG element not found after D3 generation.');
            return;
        }
        const svgData = new dom.window.XMLSerializer().serializeToString(svgElement);
        // spinner.text = 'Converting SVG to PNG...';
        svg2img(svgData, { format: 'png' as any }, (error, buffer) => {
            if (error) {
                spinner.fail(`Error converting SVG to PNG: ${error}`);
                return;
            }
            try {
                fs.writeFileSync(`${output}/${outputFileName}.png`, buffer);
                spinner.succeed(`Heatmap saved as ${output}/${outputFileName}.png`);
            } catch (writeError) {
                spinner.fail(`Error writing PNG file: ${writeError}`);
            }
        });
    });