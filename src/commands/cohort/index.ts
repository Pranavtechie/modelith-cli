import { Command } from "commander";
import { create } from "@commands/cohort/create";
import { remove } from "@commands/cohort/remove";
import { uploadData } from "./upload-data";

// Create the main cohort command
export const cohort = new Command()
    .name("cohort")
    .description("Manage student cohorts");

// Add subcommands to the main cohort command
cohort.addCommand(create);
cohort.addCommand(remove);
cohort.addCommand(uploadData)