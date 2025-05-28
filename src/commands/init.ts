import { Command } from "commander";
import ora from "ora"; // Import ora
import { dbPath, verifyConfigFile } from "@/utils/config";
import { resolve } from "path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Database } from "bun:sqlite";
import { chromium } from "playwright";
import fs from "node:fs"; // Added fs import

function verifyDatabaseSchema() {
  const spinner = ora("Verifying database schema...").start(); // Start spinner
  const db = drizzle(new Database(dbPath));
  try {
    // Determine migrations folder path, supporting both development and built layouts
    const currentModuleDir = import.meta.dirname;
    const candidatePaths = [
      resolve(currentModuleDir, "../drizzle"),
      resolve(currentModuleDir, "../../drizzle"),
    ];
    const migrationsPath = candidatePaths.find(fs.existsSync);
    if (!migrationsPath) {
      throw new Error(`Could not locate the migrations folder. Tried: ${candidatePaths.join(', ')}`);
    }

    migrate(db, { migrationsFolder: migrationsPath });
    spinner.succeed("Database Schema up to date"); // Succeed spinner
  } catch (error) {
    spinner.fail("Migration failed"); // Fail spinner
    console.error(error); // Log the full error for details
  }
}

async function checkAndSetupPlaywright() {
  const spinner = ora("Checking Playwright setup...").start();
  let playwrightChromiumPath: string | null = null;

  try {
    playwrightChromiumPath = chromium.executablePath();
  } catch (e) {
    // This can happen if Playwright itself is not correctly installed or its config is broken
    spinner.warn("Playwright cannot determine Chromium executable path. Will attempt installation.");
  }

  if (playwrightChromiumPath && fs.existsSync(playwrightChromiumPath)) {
    spinner.succeed(`Playwright Chromium executable found at: ${playwrightChromiumPath}. Verifying launch...`);
    try {
      // Still good to do a quick launch test even if executable exists
      const browser = await chromium.launch({ headless: true });
      await browser.close();
      spinner.succeed("Playwright with Chromium is installed and verified.");
      return; // Exit if already set up and verified
    } catch (launchError) {
      spinner.warn(`Chromium executable found, but launch failed: ${(launchError as Error).message}. Proceeding to installation/reinstallation.`);
    }
  } else if (playwrightChromiumPath) {
    spinner.warn(`Playwright Chromium executable expected at ${playwrightChromiumPath} but not found. Attempting to install...`);
  } else {
    spinner.warn("Playwright Chromium setup not found. Attempting to install...");
  }

  // If we've reached here, either the path wasn't found, file didn't exist, or initial launch failed.
  console.log("INFO: Running 'playwright install chromium'. This may take a few minutes.");
  spinner.text = "Installing Playwright Chromium browser..."; // Update spinner text

  const installProcess = Bun.spawn(
    ["bun", "x", "--bun", "playwright", "install", "chromium"],
    {
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const stdoutPromise = new Response(installProcess.stdout).text();
  const stderrPromise = new Response(installProcess.stderr).text();

  const exitCode = await installProcess.exited;
  const stdout = await stdoutPromise;
  const stderr = await stderrPromise;

  if (exitCode === 0) {
    spinner.succeed("Playwright Chromium browser installed successfully.");
    const verifySpinner = ora("Verifying Playwright/Chromium after installation...").start();
    try {
      const browser = await chromium.launch({ headless: true });
      await browser.close();
      verifySpinner.succeed("Playwright with Chromium is now operational.");
    } catch (postInstallError) {
      verifySpinner.fail(`Chromium installed, but Playwright still failed to launch: ${(postInstallError as Error).message}. Installation stdout: ${stdout || 'empty'}. Installation stderr: ${stderr || 'empty'}`);
    }
  } else {
    spinner.fail(
      `Playwright Chromium installation failed (exit code: ${exitCode}).
` +
      `Stdout: ${stdout || "(empty)"}
` +
      `Stderr: ${stderr || "(empty)"}`
    );
  }
}

async function buildFrontend() {
  const spinner = ora("Building frontend with Vite...").start(); // Start spinner
  try {
    const buildProcess = Bun.spawn(["bun", "run", "build:frontend"], {
      stdout: "pipe", // Pipe output to handle it
      stderr: "pipe",
    });
    const exitCode = await buildProcess.exited;
    if (exitCode === 0) {
      spinner.succeed("Frontend built successfully."); // Succeed spinner
    } else {
      const stderr = await new Response(buildProcess.stderr).text();
      spinner.fail(`Frontend build failed: ${stderr}`); // Fail spinner
    }
  } catch (error) {
    spinner.fail(`Unexpected error during frontend build: ${String(error)}`); // Fail spinner
  }
}

async function buildBackend() {
  const spinner = ora("Building backend...").start(); // Start spinner
  try {
    const buildProcess = Bun.spawn(["bun", "run", "build:backend"], {
      stdout: "pipe", // Pipe output to handle it
      stderr: "pipe",
    });
    const exitCode = await buildProcess.exited;
    if (exitCode === 0) {
      spinner.succeed("Backend built successfully."); // Succeed spinner
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

`);
}

export const init = new Command()
  .name("init")
  .description("Initialize your project and install dependencies")
  .action(async () => {
    // Check if we're in a CI environment
    const isCI = process.env.CI === "true";

    if (!isCI) {
      asciiArt();
    }

    // Check if we're running from an installed package
    const isBuiltPackage = !process.argv[1]?.includes("src");

    if (!isCI) {
      const configSpinner = ora("Verifying config file...").start(); // Start config spinner
      let configStatus = await verifyConfigFile();

      if (configStatus) {
        configSpinner.succeed("Valid Config"); // Succeed config spinner
      } else {
        configSpinner.succeed("Created New Config"); // Succeed config spinner (creation is success)
      }

      try {
        verifyDatabaseSchema();
      } catch (error) {
        console.warn(
          "Could not verify database schema. This is normal in CI environments.",
        );
      }

      let playwrightAvailable = false;
      try {
        await import("playwright");
        playwrightAvailable = true;
      } catch (e) {
        // Playwright not available
      }

      if (playwrightAvailable) {
        await checkAndSetupPlaywright();
      } else {
        // Handle case where Playwright (the package) is not installed
        if (isBuiltPackage) {
          console.log(
            "Playwright (optional dependency) was not installed with Modelith. If you need features requiring Playwright, please try installing it manually: bun install -g playwright",
          );
        } else {
          console.log(
            "Playwright is not installed in your local project. If you need features requiring Playwright, consider adding it to your project or installing it globally.",
          );
        }
      }
    } else {
      console.log("Running in CI environment, skipping environment checks.");
    }

    // Build front and backend if we're in development environment
    if (!isBuiltPackage && !isCI) {
      await buildFrontend();
      await buildBackend();
    }
  });
