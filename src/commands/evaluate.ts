import { Command } from "commander";
import { spawn } from "bun";

export const evaluate = new Command()
  .name("evaluate")
  .description("evaluate the notebooks using our web ui")
  .action(async () => {
    try {
      const proc = spawn({
        cmd: ["bun", "run", "start:dev"],
        stdout: "pipe",
        stderr: "pipe",
      });

      const exitCode = await proc.exited;

      if (exitCode !== 0) {
        console.error(`Process exited with code ${exitCode}`);
        return;
      }
    } catch (error: any) {
      console.error(`An error occurred: ${error.message}`);
    }
  });
