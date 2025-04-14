- If I remove `loadEnv()` method from the `src/db/client.ts` file the environment variable `DB_FILE_NAME` doesn't seem to populate throughout the project. Even after I've specifically added the `await loadEnv()` statement as the first part of the `index.ts` file before the commander.js initiation.

- Figure out proper type system for the codebase using drizzle type inference instead of defining long-ass types interfaces for tables for insertion and object management.

    Yes, Drizzle ORM generates TypeScript types from your schema for type-safe queries and data manipulation. Use `InferSelectModel` and `InferInsertModel` to extract types for select and insert operations.

    Example:

    ```ts
    import { pgTable, text, integer } from "drizzle-orm/pg-core";
    import { InferSelectModel, InferInsertModel } from "drizzle-orm";

    const users = pgTable("users", {
    	id: integer("id").primaryKey(),
    	name: text("name").notNull(),
    });

    type UserSelect = InferSelectModel<typeof users>;
    type UserInsert = InferInsertModel<typeof users>;
    ```

- Figure out why `String(error)` doesn't give TypeError by `error.message` gives one. and find the best way to handle this case in TypeScript

- Learn about Glob Patterns

-
