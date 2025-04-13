import { Command } from "commander";
import { spawn } from 'bun';

export const evaluate = new Command()
    .name("evaluate")
    .description("evaluate the notebooks using our web ui")
    .action(async () => {
        try {
            // Open the website in the default browser
            // Use Bun.spawn to run the 'open' command (macOS) or 'xdg-open' (Linux)
            const openCommand = process.platform === 'darwin' ? 'open' : 'xdg-open';
            Bun.spawn([openCommand, "http://localhost:3000"]); // replace with your port


            // Run the 'start' script using Bun.spawn
            const proc = spawn({
                cmd: ['bun', 'run', 'start'], // Assumes 'start' script is in package.json
                stdout: 'pipe',
                stderr: 'pipe',
            });

            // Stream the output to the console
            for await (const chunk of proc.stdout) {
                console.log(new TextDecoder().decode(chunk));
            }

            for await (const chunk of proc.stderr) {
                console.error(new TextDecoder().decode(chunk));
            }

            // Wait for the process to finish
            const exitCode = await proc.exited;

            if (exitCode !== 0) {
                console.error(`Process exited with code ${exitCode}`);
                return;
            }

        } catch (error: any) {
            console.error(`An error occurred: ${error.message}`);
        }
    });