import { Command } from "commander";
import ora from 'ora'; // Import ora
import { dbPath, verifyConfigFile } from "@/utils/config";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Database } from "bun:sqlite";
import { chromium } from 'playwright';


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


export const init = new Command()
    .name("init")
    .description("Initialize your project and install dependencies")
    .action(async () => {
        asciiArt();

        const configSpinner = ora('Verifying config file...').start(); // Start config spinner
        let configStatus = await verifyConfigFile();

        if (configStatus) {
            configSpinner.succeed("Valid Config"); // Succeed config spinner
        } else {
            configSpinner.succeed("Created New Config"); // Succeed config spinner (creation is success)
        }

        verifyDatabaseSchema();

        await checkAndSetupPlaywright();

    });