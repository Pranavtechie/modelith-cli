# Modelith Bundling Strategy

This document explains how the Modelith CLI package is bundled for NPM distribution.

## Package Structure

When published to NPM, the package includes:

- `cli-dist/`: The bundled CLI application code (main entry point)
- `backend-dist/`: The bundled backend server
- `dist/`: The bundled frontend application (Vite build)
- `drizzle/`: Database migration files
- Configuration files: `package.json`, `components.json`, `drizzle.config.ts`, etc.

## Runtime Requirements

Modelith is built specifically for the Bun JavaScript runtime:

- **Bun**: Required as the primary JavaScript runtime
- NPM package managers: Compatible for installation, but Bun is required for execution

The code is built using Bun's bundler with `--target bun` to optimize for performance with Bun.

## External Dependencies

The following dependencies are marked as external and not bundled:

- `playwright` and `playwright-core`: Used for browser automation
- `tree-sitter` and `tree-sitter-python`: Used for code parsing
- `exiftool-vendored`: Used for image metadata extraction

These are marked as optional dependencies, and users are prompted to install them separately as needed.

## Command Line Interface

After installation, you can use the CLI with:

```bash
# Install Bun first if not already installed
# https://bun.sh/docs/installation

# Use with npx (requires Bun to be installed)
npx modelith [command]

# Or install globally 
npm install -g modelith
modelith [command]
```

## Key Commands

- `modelith init`: Initialize the configuration and database
- `modelith start`: Start the backend and frontend servers
  - `--frontend-port <port>`: Specify frontend port (default: 3000)
  - `--backend-port <port>`: Specify backend port (default: 3001)
  - `--frontend`: Start only the frontend
  - `--backend`: Start only the backend

## Installation Process

When the package is installed:

1. The `postinstall` script runs `modelith init` using Bun to:
   - Verify/create the configuration file
   - Set up the database schema
   - Check for required dependencies
   - Install any missing global tools (like `serve`)

## Development vs Production

The package behaves differently when run in development mode vs as an installed package:

- In development, it builds the frontend and backend during init
- As an installed package, it uses pre-built assets

## Server Architecture

The application consists of:

1. A command-line interface for analysis operations
2. A backend server (Elysia + tRPC) for data access
3. A frontend server (Vite + React) for visualization

When using `modelith start`, both servers are launched with appropriate port configuration.

## Performance Considerations

Modelith uses Bun exclusively for several reasons:

1. **Speed**: Bun offers significant performance improvements over Node.js
2. **Integrated tooling**: Bun's bundler, package manager, and runtime are all optimized to work together
3. **Elysia compatibility**: The backend server uses Elysia, which is optimized for Bun
4. **Reduced dependencies**: Fewer runtime dependencies since Bun provides much functionality out of the box