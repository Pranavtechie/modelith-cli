import { Command } from "commander";
import ora from 'ora';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const start = new Command()
    .name("start")
    .description("Start the Modelith server (frontend and backend)")
    .option("-f, --frontend", "Start only the frontend server")
    .option("-b, --backend", "Start only the backend server")
    .option("-p, --frontend-port <port>", "Port for the frontend server", "3000")
    .option("-q, --backend-port <port>", "Port for the backend server", "3001")
    .action(async (options) => {
        const startFrontend = !options.backend || options.frontend;
        const startBackend = !options.frontend || options.backend;
        const frontendPort = options.frontendPort;
        const backendPort = options.backendPort;
        
        // Get paths relative to this file location
        const backendPath = path.resolve(__dirname, '../backend-dist/index.js');
        const frontendPath = path.resolve(__dirname, '../dist');
        
        if (startBackend) {
            const backendSpinner = ora('Starting backend server...').start();
            try {
                // Use different approach based on whether we're running the built version or in dev
                const isBuiltPackage = !process.argv[1]?.includes('src');
                
                let backendProcess;
                if (isBuiltPackage) {
                    // We're running from the installed CLI
                    process.env.PORT = backendPort;
                    backendProcess = spawn('bun', [backendPath], {
                        env: process.env,
                        stdio: 'inherit'
                    });
                } else {
                    // We're running in development mode
                    backendProcess = spawn('bun', ['run', 'start:backend'], {
                        env: {
                            ...process.env,
                            PORT: backendPort
                        } as unknown as NodeJS.ProcessEnv,
                        stdio: 'inherit'
                    });
                }
                
                backendSpinner.succeed(`Backend server started on port ${backendPort}`);
                
                // Handle server process exit
                backendProcess.on('exit', (code) => {
                    if (code !== 0) {
                        console.error(`Backend server exited with code ${code}`);
                    }
                });
            } catch (error) {
                backendSpinner.fail(`Failed to start backend server: ${error}`);
                process.exit(1);
            }
        }
        
        if (startFrontend) {
            const frontendSpinner = ora('Starting frontend server...').start();
            try {
                // Use different approach based on whether we're running the built version or in dev
                const isBuiltPackage = !process.argv[1]?.includes('src');
                
                let frontendProcess;
                if (isBuiltPackage) {
                    // We're running from the installed CLI
                    // Serve static build using 'serve'
                    frontendProcess = spawn('bun', ['x', '--bun', 'serve', '-s', frontendPath, '-l', frontendPort], {
                        stdio: 'inherit'
                    });
                } else {
                    // We're running in development mode
                    frontendProcess = spawn('bun', ['run', 'start:frontend'], {
                        env: {
                            ...process.env,
                            PORT: frontendPort
                        } as unknown as NodeJS.ProcessEnv,
                        stdio: 'inherit'
                    });
                }
                
                frontendSpinner.succeed(`Frontend server started on port ${frontendPort}`);
                
                // Handle server process exit
                frontendProcess.on('exit', (code) => {
                    if (code !== 0) {
                        console.error(`Frontend server exited with code ${code}`);
                    }
                });
            } catch (error) {
                frontendSpinner.fail(`Failed to start frontend server: ${error}`);
                process.exit(1);
            }
        }
        
        // Keep the process running
        process.stdin.resume();
        
        console.log('\nPress Ctrl+C to stop the servers');
        
        // Handle process termination
        process.on('SIGINT', () => {
            console.log('\nShutting down servers...');
            process.exit(0);
        });
    });