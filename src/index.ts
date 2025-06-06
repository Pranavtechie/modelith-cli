#!/usr/bin/env bun

import { Command } from "commander";
import packageJson from "../package.json";
import { init } from "@commands/init";
import { extract } from "@commands/extract";
import { cohort } from "@commands/cohort";
import { makeHeatmap } from "@commands/make-heatmap";
import { kaggleDump } from "@commands/kaggle-dump";
import { start } from "@commands/start";
import { loadEnv } from "@utils/config";

async function main() {
  await loadEnv();

  const program = new Command()
    .name("modelith")
    .description("evaluate your jupyter notebooks")
    .version(
      packageJson.version || "1.0.0",
      "-v, --version",
      "display the version number",
    );

  program.addCommand(init);
  program.addCommand(extract);
  program.addCommand(cohort);
  program.addCommand(kaggleDump);
  program.addCommand(makeHeatmap);
  program.addCommand(start);

  program.parse();
}

main();
