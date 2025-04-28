import { Command } from "commander";
import ora from 'ora'; // Import ora
import { dbPath, verifyConfigFile } from "@/utils/config";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Database } from "bun:sqlite";
import { chromium } from 'playwright';
import { readFileSync } from 'fs'; // Import fs to read package.json
import { existsSync } from 'fs';


function verifyDatabaseSchema() {
    const spinner = ora('Verifying database schema...').start(); // Start spinner
    const db = drizzle(new Database(dbPath));
    try {
        migrate(db, { migrationsFolder: "./drizzle" });
        spinner.succeed('Database Schema up to date'); // Succeed spinner
    } catch (error) {
        spinner.fail("Migration failed"); // Fail spinner
        console.error(error);
    }
}

async function checkAndSetupPlaywright() {
    const spinner = ora('Checking Playwright setup...').start(); // Start spinner
    try {
        const browser = await chromium.launch();
        await browser.close();
        spinner.succeed('Playwright with Chromium is installed.'); // Succeed spinner
    } catch (error) {
        spinner.warn('Playwright not installed correctly. Installing Chromium...'); // Use warn for installation step
        const installProcess = Bun.spawn(['bun', 'x', '--bun', 'playwright', 'install', 'chromium'], {
            stdout: 'pipe', // Pipe output to handle it
            stderr: 'pipe'
        });
        const exitCode = await installProcess.exited;
        if (exitCode === 0) {
            spinner.succeed('Chromium installed successfully.'); // Succeed after installation
        } else {
            const stderr = await new Response(installProcess.stderr).text();
            spinner.fail(`Chromium installation failed: ${stderr}`); // Fail if installation fails
        }
    }
}

async function checkForServe() {
    const spinner = ora('Checking for serve package...').start(); // Start spinner
    try {
        const process = Bun.spawn(['npx', 'serve', '--version'], {
            stdout: 'pipe',
            stderr: 'pipe'
        });
        const exitCode = await process.exited;
        
        if (exitCode === 0) {
            spinner.succeed('Serve package is available'); // Succeed spinner
        } else {
            spinner.warn('Serve package not found. Installing globally...');
            const installProcess = Bun.spawn(['npm', 'install', '-g', 'serve'], {
                stdout: 'pipe',
                stderr: 'pipe'
            });
            const installExitCode = await installProcess.exited;
            if (installExitCode === 0) {
                spinner.succeed('Serve package installed successfully'); // Succeed spinner
            } else {
                const stderr = await new Response(installProcess.stderr).text();
                spinner.fail(`Failed to install serve package: ${stderr}`); // Fail spinner
            }
        }
    } catch (error) {
        spinner.fail(`Error checking for serve package: ${String(error)}`); // Fail spinner
    }
}

async function buildFrontend() {
    const spinner = ora('Building frontend with Vite...').start(); // Start spinner
    try {
        const buildProcess = Bun.spawn(['bun', 'run', 'build:frontend'], {
            stdout: 'pipe', // Pipe output to handle it
            stderr: 'pipe'
        });
        const exitCode = await buildProcess.exited;
        if (exitCode === 0) {
            spinner.succeed('Frontend built successfully.'); // Succeed spinner
        } else {
            const stderr = await new Response(buildProcess.stderr).text();
            spinner.fail(`Frontend build failed: ${stderr}`); // Fail spinner
        }
    } catch (error) {
        spinner.fail(`Unexpected error during frontend build: ${String(error)}`); // Fail spinner
    }
}

async function buildBackend() {
    const spinner = ora('Building backend...').start(); // Start spinner
    try {
        const buildProcess = Bun.spawn(['bun', 'run', 'build:backend'], {
            stdout: 'pipe', // Pipe output to handle it
            stderr: 'pipe'
        });
        const exitCode = await buildProcess.exited;
        if (exitCode === 0) {
            spinner.succeed('Backend built successfully.'); // Succeed spinner
        } else {
            const stderr = await new Response(buildProcess.stderr).text();
            spinner.fail(`Backend build failed: ${stderr}`); // Fail spinner
        }
    } catch (error) {
        spinner.fail(`Unexpected error during backend build: ${String(error)}`); // Fail spinner
    }
}

function asciiArt() {
    console.log(`

███╗   ███╗ ██████╗ ██████╗ ███████╗██╗     ██╗████████╗██╗  ██╗
████╗ ████║██╔═══██╗██╔══██╗██╔════╝██║     ██║╚══██╔══╝██║  ██║
██╔████╔██║██║   ██║██║  ██║█████╗  ██║     ██║   ██║   ███████║
██║╚██╔╝██║██║   ██║██║  ██║██╔══╝  ██║     ██║   ██║   ██╔══██║
██║ ╚═╝ ██║╚██████╔╝██████╔╝███████╗███████╗██║   ██║   ██║  ██║
╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝╚═╝   ╚═╝   ╚═╝  ╚═╝

`)
}

async function ensureBunVersion() {
    const spinner = ora('Ensuring Bun version matches package.json...').start(); // Start spinner
    try {
        const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8')); // Read package.json
        const requiredVersion = packageJson.packageManager.split('@')[1]; // Extract version from packageManager field

        const versionProcess = Bun.spawn(['bun', '--version'], {
            stdout: 'pipe',
            stderr: 'pipe'
        });
        const versionOutput = await new Response(versionProcess.stdout).text();
        const currentVersion = versionOutput.trim();

        if (currentVersion === requiredVersion) {
            spinner.succeed(`Bun is already at the required version: ${requiredVersion}`); // Succeed spinner
        } else {
            spinner.warn(`Current Bun version (${currentVersion}) does not match required version (${requiredVersion}). Upgrading...`);
            const upgradeProcess = Bun.spawn(['bun', 'install', `--version=${requiredVersion}`], {
                stdout: 'pipe',
                stderr: 'pipe'
            });
            const exitCode = await upgradeProcess.exited;
            if (exitCode === 0) {
                spinner.succeed(`Bun upgraded to version ${requiredVersion} successfully.`); // Succeed spinner
            } else {
                const stderr = await new Response(upgradeProcess.stderr).text();
                spinner.fail(`Failed to upgrade Bun to version ${requiredVersion}: ${stderr}`); // Fail spinner
            }
        }
    } catch (error) {
        spinner.fail(`Unexpected error while ensuring Bun version: ${String(error)}`); // Fail spinner
    }
}

export const init = new Command()
    .name("init")
    .description("Initialize your project and install dependencies")
    .action(async () => {
        asciiArt();

        await ensureBunVersion(); // Ensure Bun version matches package.json

        const configSpinner = ora('Verifying config file...').start(); // Start config spinner
        let configStatus = await verifyConfigFile();

        if (configStatus) {
            configSpinner.succeed("Valid Config"); // Succeed config spinner
        } else {
            configSpinner.succeed("Created New Config"); // Succeed config spinner (creation is success)
        }

        verifyDatabaseSchema();

        // Check if we're running from an installed package
        const isBuiltPackage = !process.argv[1].includes('src');
        
        // Only check for playwright if it's set as an optional dependency
        if (existsSync('./node_modules/playwright')) {
            await checkAndSetupPlaywright();
        } else if (!isBuiltPackage) {
            console.log('Playwright not installed. You can install it separately with: npm install playwright');
        }

        await checkForServe();

        // Build front and backend if we're in development environment
        if (!isBuiltPackage) {
            await buildFrontend();
            await buildBackend();
        }
    });