This file is made to keep track of commands and heuristics for developing this project.

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

### Using Drizzle and drizzle-kit

##### Setting up the Database for the first time

Ensure the `.env` file is setup correctly

```bash
bunx --bun drizzle-kit push
```

##### Updating Schema and Database Migrations

First update the schema in `drizzle/schema.ts` and then run the following command to update the database

```bash
bunx --bun drizzle-kit generate
```

The `generate` command creates the SQL queries required for running the migration. Now we can run the migration.

```bash
bunx --bun drizzle-kit migrate
```
