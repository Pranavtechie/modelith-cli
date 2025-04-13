import inquirer from 'inquirer';
import { db } from '../db/client';
import { Cohort, Student } from '../db/schema';
import ora from 'ora';
import { eq, desc } from 'drizzle-orm';

/**
 * Prompts the user to select a cohort from the existing list.
 * @returns The selected cohort object or null if no cohorts exist or selection is cancelled.
 */
export async function selectCohort(): Promise<typeof Cohort.$inferSelect | null> {
    try {
        const cohorts = await db.select().from(Cohort).orderBy(desc(Cohort.cohortId));

        // Fetch student counts for each cohort
        const cohortStudentCounts = await Promise.all(cohorts.map(async (cohort) => {
            const count = await db.select().from(Student).where(eq(Student.cohortId, cohort.cohortId)).execute();
            return { cohortId: cohort.cohortId, count: count.length };
        }));



        if (cohorts.length === 0) {
            console.log('No cohorts found.');
            return null;
        }

        const { selectedCohortName } = await inquirer.prompt<{ selectedCohortName: string }>([
            {
                type: 'list',
                name: 'selectedCohortName',
                message: 'Select a cohort to perform your action:',
                choices: cohorts.map(c => {
                    const studentCount = cohortStudentCounts.find(csc => csc.cohortId === c.cohortId)?.count || 0;
                    return {
                        name: `${c.className} (${studentCount} students)`,
                        value: c.className // Store className as value for easy retrieval
                    };
                }),
            },
        ]);

        // Find the selected cohort object
        const selectedCohort = cohorts.find(c => c.className === selectedCohortName);
        return selectedCohort || null; // Should always find one, but good practice

    } catch (error) {
        if (error instanceof Error) {
            console.error(`  Error: ${error.message}`);
        } else {
            console.error(`  An unknown error occurred.`);
        }
        return null;
    }
}
