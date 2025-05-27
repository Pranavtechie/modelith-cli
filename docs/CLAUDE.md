# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- Build CLI: `bun run build:cli`
- Build Frontend: `bun run build:frontend`
- Build all: `bun run build`
- Run in development mode: `bun run dev`
- Start development servers: `bun run start:dev`

## Code Style Guidelines
- Always use `Bun` for any commands or scripts. Never use `npm`
- TypeScript with strict type checking
- ESNext target with modern JS features
- React for frontend components
- Path aliases: `@/`, `@frontend/`, `@backend/`, `@db/`, `@utils/`, `@commands/`
- Async/await pattern for asynchronous code
- Use Ora for command-line spinners when showing progress
- Use zod for validation
- Error handling with try/catch blocks and appropriate spinner feedback
- Functional React components with hooks
- Follow existing naming conventions (camelCase for variables/functions, PascalCase for types/interfaces/classes)
- Use interface for object type definitions
- Document types with JSDoc comments when appropriate
- Always make use of shadcn/ui components when asked to make a UI instead of building a custom UI from scratch

## NotebookViewer Component Summary
The NotebookViewer component is a React component that renders Jupyter notebooks with these features:
- Displays both markdown and code cells with appropriate syntax highlighting
- Handles various output types including text, HTML, images, and errors
- Shows execution count for code cells
- Provides a sample notebook when real content is not available
- Uses UI components from the design system (Card, etc.)
- Properly processes different data formats (arrays vs strings)
- Has responsive layout with scrollable content area
- Shows metadata including student name and cell count
