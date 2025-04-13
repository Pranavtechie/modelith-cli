import { Command } from "commander";
import { run } from "@utils/kaggle-playwright";
import chalk from "chalk";

export const kaggleDump = new Command()
    .name("kaggle-dump")
    .description("Download kaggle notebooks from a kaggle competition")
    .option(
        '-f, --folder <folder>',)
    .action(async (options) => {
        console.log(options)

        let folderPath = options.folder;
        if (!folderPath) {
            folderPath = process.cwd();
        }

        run(folderPath).catch((error) => {
            console.error(chalk.red("Error:"), error);
            process.exit(1);
        });
    });