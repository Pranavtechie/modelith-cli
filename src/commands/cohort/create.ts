import { Command } from "commander";
import ora from 'ora';
import { db } from "@db/client";
import { Cohort } from "@db/schema";
import { eq } from "drizzle-orm";

export const create = new Command()
    .name("create")
    .description("Create a new cohort")
    .argument('<className>', 'Class name for the cohort')
    .action(async (className) => {
        const spinner = ora(`Creating cohort with class name: ${className}`).start();

        try {
            // Check if cohort already exists using className
            const existingCohort = await db.select().from(Cohort).where(eq(Cohort.className, className)).limit(1);
            if (existingCohort.length > 0) {
                spinner.fail(`Cohort with class name "${className}" already exists.`);
                return;
            }

            await db.insert(Cohort).values({
                className: className,
                timestamp: new Date()
            });

            spinner.succeed(`Cohort with class name "${className}" created successfully.`);
        } catch (error) {
            spinner.fail(`Failed to create cohort: ${className}`);
            if (error instanceof Error) {
                console.error(`  Error: ${error.message}`);
            } else {
                console.error(`  An unknown error occurred.`);
            }

        }
    });