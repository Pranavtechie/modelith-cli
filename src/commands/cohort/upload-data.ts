import { Command } from "commander";
import ora from 'ora';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { db } from "@db/client"; // Use path alias
import { Student } from "@db/schema"; // Use path alias
import { selectCohort } from "../../utils/cohortUtils";

export const uploadData = new Command() // Renamed export for clarity
    .name("upload-data")
    .description("Upload your student's data to a chosen cohort")
    .argument('<filename>', 'The name of the csv file to upload data from')
    .action(async (filename: string) => {
        const spinner = ora();

        try {
            // Use the utility function to select the cohort

            const selectedCohort = await selectCohort();

            if (!selectedCohort || !selectedCohort.cohortId) {
                // Message handled by selectCohort or user cancelled
                return;
            }
            const selectedCohortId = selectedCohort.cohortId;
            const selectedCohortName = selectedCohort.className; // Get name for messages

            spinner.succeed(`Selected cohort: ${selectedCohortName}`);

            spinner.start(`Reading data from ${filename}...`);

            if (!fs.existsSync(filename)) {
                spinner.fail(`Error: File not found at ${filename}`);
                return;
            }

            const fileContent = fs.readFileSync(filename, 'utf-8');



            let records: any[];
            try {
                records = parse(fileContent, {
                    columns: true, // Use the first row as header
                    skip_empty_lines: true,
                    trim: true, // Trim whitespace from values
                });
            } catch (parseError: any) {
                return;
            }


            if (records.length === 0) {
                spinner.warn("CSV file is empty or contains no data rows.");
                return;
            }

            // Validate headers (case-insensitive check)
            const headers = Object.keys(records[0]).map(h => h.toLowerCase());
            const requiredHeaders = ["regno", "name"];
            const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

            if (missingHeaders.length > 0) {
                spinner.fail(`Error: CSV file is missing required columns: ${missingHeaders.join(', ')}. Required columns are 'regno' and 'name'.`);
                return;
            }



            const studentsToInsert = records.map(record => {
                // Find the correct keys case-insensitively
                const regNoKey = Object.keys(record).find(k => k.toLowerCase() === 'regno');
                const nameKey = Object.keys(record).find(k => k.toLowerCase() === 'name');

                if (!regNoKey || !nameKey) {
                    // This should theoretically not happen due to header check, but good for safety
                    throw new Error("Could not find regno or name key despite header check.");
                }

                return {
                    cohortId: selectedCohortId,
                    regNo: record[regNoKey],
                    name: record[nameKey],
                };
            }).filter(student => student.regNo && student.name); // Filter out rows with empty regno or name

            if (studentsToInsert.length !== records.length) {
                spinner.warn(`Filtered out ${records.length - studentsToInsert.length} rows with missing 'regno' or 'name'.`);
            }

            if (studentsToInsert.length === 0) {
                spinner.fail("No valid student data found in the CSV to upload.");
                return;
            }



            try {
                // Use insert with onConflictDoNothing to handle potential duplicates
                // based on the unique constraint (regNo, cohortId)
                const result = await db.insert(Student)
                    .values(studentsToInsert)
                    .onConflictDoNothing() // Ignore rows that violate the unique constraint
                    .returning({ insertedId: Student.studentId }); // Get IDs of successfully inserted rows

                const insertedCount = result.length;
                const skippedCount = studentsToInsert.length - insertedCount;

                if (insertedCount > 0) {
                    spinner.succeed(`Successfully uploaded ${insertedCount} students.`);
                } else {
                    spinner.warn("No new students were uploaded.");
                }
                if (skippedCount > 0) {
                    spinner.info(`${skippedCount} students were skipped (likely duplicates).`);
                }

            } catch (dbError: any) {
                // Catch other potential DB errors besides unique constraints
                spinner.fail(`Database error during upload: ${dbError.message}`);
                console.error("Detailed error:", dbError); // Log detailed error for debugging
            }

        } catch (error: any) {
            spinner.fail(`An unexpected error occurred: ${error.message}`);
            console.error("Detailed error:", error); // Log detailed error for debugging
        }
    });