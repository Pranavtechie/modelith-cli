import { Command } from "commander";
import ora from 'ora';
import inquirer from 'inquirer';
import { db } from "../../db/client";
import { Cohort, Student, Run, NotebookMetadata } from "../../db/schema";
import { eq, count, inArray, SQLWrapper } from "drizzle-orm"; // Import inArray and SQLWrapper
import { selectCohort } from "../../utils/cohortUtils"; // Import the utility function

export const remove = new Command()
    .name("remove")
    .description("Remove an existing cohort and associated students")
    .action(async () => {
        const selectedCohort = await selectCohort();

        if (!selectedCohort || !selectedCohort.cohortId) {
            // Message already handled in selectCohort or user cancelled
            return;
        }

        const cohortId = selectedCohort.cohortId;
        const cohortName = selectedCohort.className;

        // Clarify that the student's table would also be deleted.
        const { confirmDelete } = await inquirer.prompt<{ confirmDelete: boolean }>([
            {
                type: 'confirm',
                name: 'confirmDelete',
                message: `Are you sure you want to delete the cohort \"${cohortName}\"? This will also delete all associated student records. This action cannot be undone.`,
                default: false,
            },
        ]);

        if (!confirmDelete) {
            console.log("Cohort removal cancelled.");
            return;
        }

        const spinner = ora(`Checking dependencies for cohort \"${cohortName}\"...`).start();

        try {
            // Check if the cohort id is used in Run table
            const runCountResult = await db.select({ value: count() }).from(Run).where(eq(Run.cohortId, cohortId));
            // count() always returns an array with one object, so direct access is safe.
            const runCount = runCountResult[0].value;

            if (runCount > 0) {
                spinner.fail(`Cannot delete cohort \"${cohortName}\" because it is associated with ${runCount} run(s). Please remove the runs first.`);
                return;
            }

            // Check if the cohort id is used indirectly via Students in NotebookMetadata table
            // We need to get all student IDs for the cohort first
            const studentsInCohort = await db.select({ studentId: Student.studentId }).from(Student).where(eq(Student.cohortId, cohortId));
            // Filter out any potential null/undefined IDs, although studentId should be non-null as PK
            const studentIds = studentsInCohort.map(s => s.studentId).filter((id): id is string => id !== null && id !== undefined);

            let notebookMetadataCount = 0;
            if (studentIds.length > 0) {
                // Check NotebookMetadata table using the list of student IDs with inArray
                // Ensure studentIds is not empty before calling inArray
                const notebookMetadataCountResult = await db
                    .select({ value: count() })
                    .from(NotebookMetadata)
                    .where(inArray(NotebookMetadata.studentId, studentIds as (string | SQLWrapper)[])); // Cast to satisfy inArray type
                // count() always returns an array with one object
                notebookMetadataCount = notebookMetadataCountResult[0].value;
            }

            if (notebookMetadataCount > 0) {
                spinner.fail(`Cannot delete cohort \"${cohortName}\" because its students are associated with ${notebookMetadataCount} notebook metadata entries. Please remove the associated notebook metadata first.`);
                return;
            }

            spinner.text = `Deleting cohort \"${cohortName}\" and associated students...`;

            // If checks pass, delete associated students first, then the cohort
            // Use transaction for atomicity
            await db.transaction(async (tx) => {
                await tx.delete(Student).where(eq(Student.cohortId, cohortId));
                await tx.delete(Cohort).where(eq(Cohort.cohortId, cohortId));
            });

            spinner.succeed(`Cohort \"${cohortName}\" and associated students deleted successfully.`);

        } catch (error) {
            spinner.fail(`Failed to remove cohort: ${cohortName}`);
            if (error instanceof Error) {
                console.error(`  Error: ${error.message}`);
            } else {
                console.error(`  An unknown error occurred.`);
            }
            // process.exit(1); // Exit if critical
        }
    });