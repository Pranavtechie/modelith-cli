#!/usr/bin/env bun

import { Command } from "commander"
import packageJson from "../package.json"
import { init } from "@commands/init"
import { extract } from "@commands/extract"
import { evaluate } from "@commands/evaluate"
import { cohort } from "@commands/cohort"
import { kaggleDump } from "@commands/kaggle-dump"
import { loadEnv } from "@utils/config"

async function main() {
    await loadEnv();

    const program = new Command()
        .name("modelith")
        .description("evaluate your jupyter notebooks")
        .version(
            packageJson.version || "1.0.0",
            "-v, --version",
            "display the version number")

    program.addCommand(init)
    program.addCommand(extract)
    program.addCommand(evaluate)
    program.addCommand(cohort)
    program.addCommand(kaggleDump)

    program.parse()


}


main()