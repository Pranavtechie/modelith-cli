import { createFileRoute } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { trpc } from "../main";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@frontend/components/ui/table";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@frontend/components/ui/card";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@frontend/components/ui/tabs";
import { extractAndValidateNotebook } from '@frontend/lib/notebook-schemas';

const NotebookViewer = React.lazy(() => import("@frontend/components/NotebookViewer"));

// Define the route parameter structure
interface DetailsParams {
  pair: string; // Format: "runId:studentA:studentB"
}

export const Route = createFileRoute("/details/$pair")({
  validateParams: (params: DetailsParams) => params,
  component: DetailsPage,
});

// Utility function to highlight matching metrics
const highlightMatches = (valueA: any, valueB: any): boolean => {
  if (valueA === null || valueB === null) return false;

  // For numerical values, check if they're similar within a small margin
  if (typeof valueA === 'number' && typeof valueB === 'number') {
    // For very small values, compare with small epsilon
    if (Math.abs(valueA) < 0.01 && Math.abs(valueB) < 0.01) return true;

    // For larger values, check relative difference
    const diff = Math.abs(valueA - valueB);
    const avg = (Math.abs(valueA) + Math.abs(valueB)) / 2;
    return diff / avg < 0.05; // 5% difference threshold
  }

  // For arrays or objects, stringify and compare
  if (typeof valueA === 'object' && typeof valueB === 'object') {
    return JSON.stringify(valueA) === JSON.stringify(valueB);
  }

  // For other types, direct comparison
  return valueA === valueB;
};

// Format a value for display
const formatValue = (value: any): string => {
  if (value === null || value === undefined) return "N/A";

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch (e) {
      return "Complex object";
    }
  }

  return String(value);
};

// Note: We now use the extractAndValidateNotebook function from notebook-schemas.ts

function DetailsPage() {
  const { pair } = Route.useParams();
  const [runId, studentA, studentB] = pair.split(":");

  // Fetch comparison data
  const comparison = trpc.getNotebookMetadataComparison.useQuery({
    runId,
    studentA,
    studentB
  }, {
    enabled: !!(runId && studentA && studentB),
  });

  // Keep track of which metrics match
  const [matchingMetrics, setMatchingMetrics] = useState<Set<string>>(new Set());

  // Extract notebook content using the validated schema approach
  const notebookA = comparison.data?.notebookA?.metadataJson
    ? extractAndValidateNotebook(comparison.data.notebookA.metadataJson)
    : null;

  const notebookB = comparison.data?.notebookB?.metadataJson
    ? extractAndValidateNotebook(comparison.data.notebookB.metadataJson)
    : null;

  // Log notebook content for debugging
  useEffect(() => {
    if (comparison.data) {
      console.log("Notebook metadata A:", comparison.data.notebookA?.metadataJson);
      console.log("Parsed notebook A:", notebookA);
      console.log("Notebook metadata B:", comparison.data.notebookB?.metadataJson);
      console.log("Parsed notebook B:", notebookB);

      // Force re-render if we have notebook data
      if (notebookA || notebookB) {
        console.log("Notebooks loaded successfully!");
      }
    }
  }, [comparison.data, notebookA, notebookB]);

  // Compute matching metrics when data is loaded
  useEffect(() => {
    if (comparison.data?.notebookA && comparison.data?.notebookB) {
      const matches = new Set<string>();
      const notebookA = comparison.data.notebookA;
      const notebookB = comparison.data.notebookB;

      // Check each property
      Object.keys(notebookA).forEach(key => {
        if (highlightMatches(notebookA[key as keyof typeof notebookA], notebookB[key as keyof typeof notebookB])) {
          matches.add(key);
        }
      });

      setMatchingMetrics(matches);
    }
  }, [comparison.data]);

  // Render metadata comparison
  const renderMetadataComparison = () => {
    if (!comparison.data || !comparison.data.notebookA || !comparison.data.notebookB) {
      return <div className="text-center py-10">No metadata available</div>;
    }

    const { notebookA, notebookB } = comparison.data;

    // Get all available metrics (combine keys from both notebooks)
    const allMetrics = new Set([
      ...Object.keys(notebookA),
      ...Object.keys(notebookB)
    ]);

    // Filter out some keys we don't want to display
    const excludedKeys = new Set(['notebookId', 'runId', 'studentId', 'metadataJson']);
    const metricsToShow = Array.from(allMetrics)
      .filter(key => !excludedKeys.has(key))
      .sort();

    return (
      <Table>
        <TableCaption>Notebook Metadata Comparison</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Metric</TableHead>
            <TableHead>Student A: {comparison.data.studentA?.regNo || studentA}</TableHead>
            <TableHead>Student B: {comparison.data.studentB?.regNo || studentB}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {metricsToShow.map(metric => {
            const isMatching = matchingMetrics.has(metric);
            const valueA = notebookA[metric as keyof typeof notebookA];
            const valueB = notebookB[metric as keyof typeof notebookB];

            return (
              <TableRow key={metric} className={isMatching ? "bg-yellow-50" : ""}>
                <TableCell className="font-medium">{metric}</TableCell>
                <TableCell className={isMatching ? "bg-yellow-100" : ""}>
                  {formatValue(valueA)}
                </TableCell>
                <TableCell className={isMatching ? "bg-yellow-100" : ""}>
                  {formatValue(valueB)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  };

  // Render notebook comparison
  const renderNotebookComparison = () => {
    const studentAName = comparison.data?.studentA?.regNo || studentA;
    const studentBName = comparison.data?.studentB?.regNo || studentB;

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <React.Suspense fallback={<div className="p-4 text-center">Loading notebook A...</div>}>
          <NotebookViewer
            notebookContent={notebookA}
            title={`Notebook A`}
            studentName={studentAName}
          />
        </React.Suspense>
        <React.Suspense fallback={<div className="p-4 text-center">Loading notebook B...</div>}>
          <NotebookViewer
            notebookContent={notebookB}
            title={`Notebook B`}
            studentName={studentBName}
          />
        </React.Suspense>
      </div>
    );
  };

  // Render overall similarity information
  const renderSimilarityInfo = () => {
    if (!comparison.data?.similarity) {
      return null;
    }

    const { similarity } = comparison.data;

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Similarity Details</CardTitle>
          <CardDescription>
            Metrics comparing the two notebooks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="font-medium">Similarity Score</div>
              <div className="text-2xl font-bold">{similarity.similarityScore.toFixed(4)}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded-md">
              <div className="font-medium">Tree Edit Distance</div>
              <div className="text-2xl font-bold">{similarity.treeEditDistance.toFixed(4)}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Notebook Comparison</h1>

        {comparison.data?.studentA && comparison.data?.studentB && (
          <div className="text-sm">
            Comparing <span className="font-medium">{comparison.data.studentA.regNo || studentA}</span> with{" "}
            <span className="font-medium">{comparison.data.studentB.regNo || studentB}</span>
          </div>
        )}
      </div>

      {/* Similarity information */}
      {renderSimilarityInfo()}

      {/* Loading state */}
      {comparison.isLoading && (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Error state */}
      {comparison.isError && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          Error loading comparison data: {comparison.error.message}
        </div>
      )}

      {/* Content tabs */}
      {!comparison.isLoading && !comparison.isError && (
        <Tabs defaultValue="metadata" className="w-full mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="metadata">Metadata Comparison</TabsTrigger>
            <TabsTrigger value="notebooks">Notebook Files</TabsTrigger>
          </TabsList>
          <TabsContent value="metadata" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Metadata Comparison</CardTitle>
                <CardDescription>
                  Side-by-side comparison of notebook metrics with matching values highlighted
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {renderMetadataComparison()}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="notebooks" className="mt-6">
            {renderNotebookComparison()}
          </TabsContent>
        </Tabs>
      )}

      {/* Debug information */}
      {process.env.NODE_ENV !== 'production' && !comparison.isLoading && !comparison.isError && (
        <Card className="mt-6 bg-gray-50">
          <CardHeader>
            <CardTitle className="text-sm">Debug Information</CardTitle>
          </CardHeader>
          <CardContent className="text-xs">
            <details>
              <summary>Parsed Notebook Structure</summary>
              <div className="mt-2 overflow-auto max-h-[300px]">
                <div>Student A ({comparison.data?.studentA?.regNo || studentA}): {notebookA ? `${notebookA.cells.length} cells found` : 'No notebook parsed'}</div>
                <div>Student B ({comparison.data?.studentB?.regNo || studentB}): {notebookB ? `${notebookB.cells.length} cells found` : 'No notebook parsed'}</div>
                {notebookA && (
                  <pre className="mt-2 p-2 bg-gray-100 text-xs overflow-auto">
                    {JSON.stringify({
                      nbformat: notebookA.nbformat,
                      nbformat_minor: notebookA.nbformat_minor,
                      metadata: notebookA.metadata,
                      cell_count: notebookA.cells.length,
                      cell_types: notebookA.cells.map(c => c.cell_type)
                    }, null, 2)}
                  </pre>
                )}
              </div>
            </details>
          </CardContent>
        </Card>
      )}
    </div>
  );
}