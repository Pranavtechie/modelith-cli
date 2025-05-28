import { Command } from "commander";
import ora from "ora"; // Import ora
import { dbPath, verifyConfigFile } from "@/utils/config";
import { resolve } from "path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { Database } from "bun:sqlite";
import { chromium } from "playwright";

function verifyDatabaseSchema() {
  const spinner = ora("Verifying database schema...").start(); // Start spinner
  const db = drizzle(new Database(dbPath));
  try {
    let migrationsPath = "./drizzle";
    console.log(migrationsPath);
    // Ensure the path is absolute
    migrationsPath = resolve(migrationsPath);
    
    migrate(db, { migrationsFolder: migrationsPath });
    spinner.succeed("Database Schema up to date"); // Succeed spinner
  } catch (error) {
    spinner.fail("Migration failed"); // Fail spinner
    console.error(error);
  }
}

async function checkAndSetupPlaywright() {
  const spinner = ora("Checking Playwright setup...").start(); // Start spinner
  try {
    const browser = await chromium.launch();
    await browser.close();
    spinner.succeed("Playwright with Chromium is installed."); // Succeed spinner
  } catch (error) {
    spinner.warn("Playwright not installed correctly. Installing Chromium..."); // Use warn for installation step
    const installProcess = Bun.spawn(
      ["bun", "x", "--bun", "playwright", "install", "chromium"],
      {
        stdout: "pipe", // Pipe output to handle it
        stderr: "pipe",
      },
    );
    const exitCode = await installProcess.exited;
    if (exitCode === 0) {
      spinner.succeed("Chromium installed successfully."); // Succeed after installation
    } else {
      const stderr = await new Response(installProcess.stderr).text();
      spinner.fail(`Chromium installation failed: ${stderr}`); // Fail if installation fails
    }
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
