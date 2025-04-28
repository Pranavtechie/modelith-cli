import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { db } from "@db/client";
import { Cohort, Run, Similarity, Student, NotebookMetadata } from "@db/schema";
import { eq, and } from "drizzle-orm";

// Initialize tRPC
const trpc = initTRPC.create();
const router = trpc.router;
const publicProcedure = trpc.procedure;

// Define tRPC routes
const appRouter = router({
  // Original demo endpoints
  getProjects: publicProcedure.query(() => {
    return [
      { id: 1, name: "Project A", status: "Active" },
      { id: 2, name: "Project B", status: "Completed" },
      { id: 3, name: "Project C", status: "Pending" },
    ];
  }),
  getProjectById: publicProcedure.input(z.number()).query(({ input }) => {
    const projects = [
      { id: 1, name: "Project A", status: "Active" },
      { id: 2, name: "Project B", status: "Completed" },
      { id: 3, name: "Project C", status: "Pending" },
    ];
    return projects.find((project) => project.id === input);
  }),

  // New endpoints for the similarity matrix feature
  getCohorts: publicProcedure.query(async () => {
    return await db.select().from(Cohort).orderBy(Cohort.timestamp);
  }),

  getRunsByCohort: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      return await db
        .select()
        .from(Run)
        .where(eq(Run.cohortId, input))
        .orderBy(Run.timestamp);
    }),

  getSimilarityDataByRun: publicProcedure
    .input(z.string())
    .query(async ({ input }) => {
      // Get all similarity data for this run
      const similarities = await db
        .select()
        .from(Similarity)
        .where(eq(Similarity.runId, input));

      // Get all students from this run's cohort
      const runData = await db
        .select()
        .from(Run)
        .where(eq(Run.runId, input))
        .limit(1);
      if (!runData.length) return { data: [], students: [] };

      const cohortId = runData[0].cohortId;
      const students = await db
        .select({
          studentId: Student.studentId,
          name: Student.name,
          regNo: Student.regNo,
        })
        .from(Student)
        .where(eq(Student.cohortId, cohortId));

      // Format the data for the similarity matrix
      // Create a matrix where each cell is the similarity score between two students
      const studentIds = students.map((s) => s.studentId);
      const matrix: number[][] = Array(studentIds.length)
        .fill(0)
        .map(() => Array(studentIds.length).fill(0));

      // Fill diagonal with 1.0 (student compared with self)
      for (let i = 0; i < studentIds.length; i++) {
        matrix[i][i] = 1.0;
      }

      // Fill the matrix with similarity scores
      similarities.forEach((sim) => {
        const indexA = studentIds.indexOf(sim.studentA);
        const indexB = studentIds.indexOf(sim.studentB);

        if (indexA !== -1 && indexB !== -1) {
          matrix[indexA][indexB] = sim.similarityScore;
          // Fill symmetric part of matrix (if not already filled)
          if (matrix[indexB][indexA] === 0 && indexA !== indexB) {
            matrix[indexB][indexA] = sim.similarityScore;
          }
        }
      });

      // Use student registration numbers or names as labels
      const labels = students.map((s) => s.regNo || s.name || s.studentId);

      return {
        data: matrix,
        students: labels,
        studentIds: studentIds,
      };
    }),
    
  getNotebookMetadataComparison: publicProcedure
    .input(z.object({
      runId: z.string(),
      studentA: z.string(),
      studentB: z.string()
    }))
    .query(async ({ input }) => {
      const { runId, studentA, studentB } = input;
      
      // Get similarity data between these two students
      const similarity = await db
        .select()
        .from(Similarity)
        .where(
          and(
            eq(Similarity.runId, runId),
            eq(Similarity.studentA, studentA),
            eq(Similarity.studentB, studentB)
          )
        )
        .limit(1);
        
      // If no direct match, try the reverse order
      const similarityData = similarity.length > 0 ? similarity[0] : await db
        .select()
        .from(Similarity)
        .where(
          and(
            eq(Similarity.runId, runId),
            eq(Similarity.studentA, studentB),
            eq(Similarity.studentB, studentA)
          )
        )
        .limit(1)
        .then(data => data.length > 0 ? data[0] : null);
      
      // Get notebook metadata for both students
      const notebookA = await db
        .select()
        .from(NotebookMetadata)
        .where(
          and(
            eq(NotebookMetadata.runId, runId),
            eq(NotebookMetadata.studentId, studentA)
          )
        )
        .limit(1)
        .then(data => data.length > 0 ? data[0] : null);
        
      const notebookB = await db
        .select()
        .from(NotebookMetadata)
        .where(
          and(
            eq(NotebookMetadata.runId, runId),
            eq(NotebookMetadata.studentId, studentB)
          )
        )
        .limit(1)
        .then(data => data.length > 0 ? data[0] : null);
        
      // Get student details
      const studentADetails = await db
        .select()
        .from(Student)
        .where(eq(Student.studentId, studentA))
        .limit(1)
        .then(data => data.length > 0 ? data[0] : null);
        
      const studentBDetails = await db
        .select()
        .from(Student)
        .where(eq(Student.studentId, studentB))
        .limit(1)
        .then(data => data.length > 0 ? data[0] : null);
        
      return {
        similarity: similarityData,
        notebookA,
        notebookB,
        studentA: studentADetails,
        studentB: studentBDetails
      };
    }),

});

// Export type for frontend usage
export type AppRouter = typeof appRouter;

// Create Elysia app with tRPC
const app = new Elysia()
  .use(cors())
  .get("/", () => "Modelith API is running!")
  .all("/trpc/*", async (context) => {
    // Handle tRPC request
    return fetchRequestHandler({
      endpoint: "/trpc",
      req: context.request,
      router: appRouter,
      createContext: () => ({}),
    });
  })
  .listen(3001);

console.log(
  `🦊 Elysia API with tRPC is running at ${app.server?.hostname}:${app.server?.port}`,
);
