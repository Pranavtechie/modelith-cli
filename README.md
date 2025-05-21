# Modelith

Modelith is an open-source, CLI-based tool to quickly compare and make it easier to evaluate any kind of coding assignment. Built for Professors, TAs, Teachers.

## Features

- Quickly draw a comparison of all the submissions in a folder with the help of ASTs. Currently only supports `.ipynb` files
- Web interface to compare and filter submissions using thresholds
- Identify plagiarized/copied submissions through similarity matrix
- Simple storage solution (in SQLite) for all submissions
- Class management to evaluate and maintain records of multiple classes
- 🚧 Trend assessment for multiple assignments throughout the course/class
- 🚧 Support for multiple languages (C, C++, Java, R, etc.)

## Installation

Modelith requires [Bun](https://bun.sh/) as its JavaScript runtime. First install Bun:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
```

Then you can install Modelith from npm:

```bash
# Install globally
bun install -g modelith

# Or use without installing
bun x modelith [command]
```

## Getting Started

After installing Modelith, initialize it:

```bash
modelith init
```

This command sets up your configuration, initializes the local database, and ensures that necessary components like Playwright's browser (for features such as Kaggle notebook dumping) are ready. If Playwright (an optional feature) is installed, `init` will attempt to download the required browser version if it's missing.

## Key Commands

```bash
# Initialize Modelith
modelith init

# Start the web interface
modelith start

# Create a new cohort
modelith cohort create

# Extract notebook features
modelith extract [options]

# Generate a similarity heatmap
modelith make-heatmap [options]

# View all commands and options
modelith --help
```

## Web Interface

Modelith includes a web interface for visualizing and analyzing notebook comparisons:

```bash
# Start both frontend and backend servers
modelith start

# Start only frontend server
modelith start --frontend

# Start only backend server
modelith start --backend

# Customize ports
modelith start --frontend-port 8080 --backend-port 8081
```

## Development

Modelith relies heavily on [Bun](https://bun.sh/) for package management and running the CLI. You can install Bun by following their [installation guide](https://bun.sh/docs/installation).

Modelith uses some packages with native components (e.g., for code parsing and image processing). While `bun` typically handles these automatically, you might need a suitable build environment (like C++ compilers, Python) on certain OS/architectures if pre-built binaries are not available for your system.

Ensure that database migration files (SQL files and snapshots in the `drizzle` directory, especially `drizzle/meta/_journal.json`) are up-to-date and committed to the repository, as these are crucial for the `modelith init` command to correctly set up the database schema.

For development:

```bash
# Clone the repository
git clone https://github.com/yourusername/modelith-cli.git
cd modelith-cli

# Install dependencies
bun install

# Start in development mode
bun run dev

# Build for distribution
bun run build
```

For more details on the bundling strategy, see [BUNDLING.md](./BUNDLING.md).

## Documentation

You can view the docs at [docs.modelith.com](https://docs.modelith.com) for more information on how to use the tool.
