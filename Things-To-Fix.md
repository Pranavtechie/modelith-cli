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

- understand the problem of native modules when compiling to executable using bun

    ```
    This issue is caused by the way Bun's --compile feature bundles and compiles dependencies, especially native modules like tree-sitter and its language bindings (tree-sitter-python). When you run with bun run, Bun uses the source files and dynamic requires, but when you use --compile, Bun tries to bundle everything, which can break dynamic language loading and native bindings.

    tree-sitter loads language grammars (like Python, R, etc.) dynamically at runtime. If Bun's compiler doesn't handle these native modules or dynamic requires correctly, it may default to the wrong language or fail to load the correct one, resulting in errors like undefined is not an object (evaluating 'R.language.nodeSubclasses[A]') and ReferenceError: SyntaxNode is not defined.

    How to fix:

    Explicitly import and register the Python grammar
    Make sure you are importing tree-sitter and tree-sitter-python directly and passing the correct language object to setLanguage.
    Example:

    Avoid dynamic requires or language loading
    Do not use dynamic imports or require statements for the language module. Always import the language statically.

    Check Bun compile compatibility
    Some native modules (like tree-sitter and its grammars) may not be fully compatible with Bun's --compile. If the above doesn't work, you may need to:

    Run your CLI with bun run instead of the compiled binary.
    Or, use Node.js for the CLI if you need full compatibility with native modules.
    If you must use --compile:

    Try excluding tree-sitter and tree-sitter-python from compilation and require them at runtime, but this is not always possible with Bun's current capabilities.
    Check for any Bun-specific issues or updates regarding native module support.
    Summary:
    This is a Bun --compile limitation with native modules and dynamic language loading. The best solution is to statically import tree-sitter and tree-sitter-python, and if that doesn't work, use bun run or Node.js for this part of your toolchain.

    Let me know if you want a code snippet showing the correct import and usage pattern for tree-sitter and tree-sitter-python.
    ```

- based on the above point, figure out the difference between native modules and how the node wrapper around the tree-sitter package is written and functions.

- stupid mistake #xx, I didn't know that I was supposed to add a shebang in the entry file which is `src/index.ts` for bun to recognize it as a valid executable.
