This file is made to keep track of commands and heuristics for developing this project.

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
