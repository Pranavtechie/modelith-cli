"use client";

import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import { Button } from "@frontend/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider
} from "@frontend/components/ui/tooltip";
import * as d3 from "d3";
import { Download } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "../main";

import {
  createFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: SimilarityMatrix,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      cohortId: (search.cohortId as string) || "",
      runId: (search.runId as string) || "",
      viewMode: (search.view as "matrix" | "list") || "matrix",
      leftValue: Number(search.left) || 0.3,
      rightValue: Number(search.right) || 0.7,
    };
  },
  preloadStaleTime: 1000 * 60 * 5, // 5 minutes
  loaderDeps: ({ search }) => [search.cohortId, search.runId],
  loader: ({ context, deps }) => {
    const queryClient = (context as any).queryClient;
    const [cohortId, runId] = deps;

    // Preload cohorts
    if (queryClient) {
      queryClient.prefetchQuery({
        queryKey: ["trpc", "getCohorts"],
        staleTime: Infinity, // Cohorts don't change very often
      });
    }

    // Preload runs if cohortId is provided
    if (cohortId && queryClient) {
      queryClient.prefetchQuery({
        queryKey: ["trpc", "getRunsByCohort", { input: cohortId }],
        staleTime: Infinity, // Runs for a cohort don't change once created
      });
    }

    // Preload similarity data if runId is provided
    if (runId && queryClient) {
      queryClient.prefetchQuery({
        queryKey: ["trpc", "getSimilarityDataByRun", { input: runId }],
        staleTime: Infinity, // Similarity data is static once generated
      });
    }

    return {};
  },
});

// Define a more specific type for hovered cell
type HoveredCell = { x: number; y: number; value: number } | null;

// CSV download utility function
const downloadCSV = (data: number[][], xLabels: string[], yLabels: string[], runId: string) => {
  // Validate inputs
  if (!data || !xLabels || !yLabels || !runId) {
    console.error('Invalid data provided for CSV download');
    return;
  }

  // Collect all pairs with their values
  const pairs: { studentOne: string; studentTwo: string; similarityScore: number }[] = [];

  data.forEach((row, i) => {
    row.forEach((value, j) => {
      // Only add pairs from upper triangle (above diagonal) to avoid duplicates
      if (i < j) {
        pairs.push({
          studentOne: xLabels[i] || '',
          studentTwo: yLabels[j] || '',
          similarityScore: value
        });
      }
    });
  });

  // Sort by similarity score in descending order
  pairs.sort((a, b) => b.similarityScore - a.similarityScore);

  // Convert to CSV format
  const csvHeader = "student_one,student_two,similarity_score\n";
  const csvRows = pairs.map(pair =>
    `"${pair.studentOne}","${pair.studentTwo}",${pair.similarityScore.toFixed(4)}`
  ).join('\n');

  const csvContent = csvHeader + csvRows;

  // Create and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `similarity_scores_${runId}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// D3 Heatmap Component
const D3HeatMap = ({
  data,
  xLabels,
  yLabels,
  leftValue,
  rightValue,
  onCellClick,
}: {
  data: number[][];
  xLabels: string[];
  yLabels: string[];
  leftValue: number;
  rightValue: number;
  onCellClick: (x: number, y: number) => void;
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeCell = useRef<{ x: number; y: number; value: number } | null>(
    null,
  );
  const [showTooltip, setShowTooltip] = useState(false);
  const cellsRef = useRef<
    Map<string, { rect: SVGRectElement; j: number; i: number; value: number }>
  >(new Map());

  // Floating UI setup for tooltip positioning
  const { refs, floatingStyles, update } = useFloating({
    placement: "top",
    middleware: [offset(10), flip(), shift()],
    whileElementsMounted: autoUpdate,
  });

  // Color scale based on slider values
  const getColor = (value: number) => {
    if (value <= leftValue) return "#4ade80";
    if (value <= rightValue) return "#fbbf24";
    return "#ef4444";
  };

  // Create the heatmap with D3
  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();
    cellsRef.current.clear();

    // Get container dimensions for responsive sizing
    const containerWidth = svgRef.current.parentElement?.clientWidth || 1000;
    const containerHeight = Math.max(800, window.innerHeight * 0.7);

    // Setup dimensions - making it larger and more responsive
    const margin = { top: 40, right: 20, bottom: 150, left: 150 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Create scales
    const x = d3.scaleBand().range([0, width]).domain(xLabels).padding(0.05);
    const y = d3.scaleBand().range([0, height]).domain(yLabels).padding(0.05);

    // Add X axis labels with better visibility
    svg
      .append("g")
      .style("font-size", "12px")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-65)")
      .text((d: any) => d || '');

    // Add Y axis labels with better visibility
    svg.append("g").style("font-size", "12px").call(d3.axisLeft(y))
      .selectAll("text")
      .text((d: any) => d || '');

    // Create visual guide for lower half (not displayed)
    svg
      .append("path")
      .attr("d", `M0,0 L${width},${height}`)
      .attr("stroke", "#ddd")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "5,5");

    // Create and update cells - only drawing upper triangle (omitting diagonal)
    data.forEach((row, i) => {
      row.forEach((value, j) => {
        // Skip diagonal (i === j) and lower triangle (i > j)
        if (i >= j) {
          return;
        }

        // Cell size calculation for better visibility
        const cellSize = Math.min(x.bandwidth(), y.bandwidth());

        // Determine if we should show the value directly based on the cell size
        const showValueText = cellSize > 25;

        // Create the cell
        const rect = svg
          .append("rect")
          .attr("x", x(xLabels[j] || '') || 0)
          .attr("y", y(yLabels[i] || '') || 0)
          .attr("width", x.bandwidth())
          .attr("height", y.bandwidth())
          .style("fill", getColor(value))
          .style("stroke", "#f0f0f0")
          .style("stroke-width", 0.5)
          .style("cursor", "pointer")
          .attr("data-x", j)
          .attr("data-y", i)
          .attr("data-value", value)
          .node();

        // Store reference to the cell for efficient hover updates
        if (rect) {
          cellsRef.current.set(`${i}-${j}`, { rect, i, j, value });

          // Add click handler directly to the DOM element for better performance
          rect.addEventListener("click", () => onCellClick(j, i));
        }

        // Add value text only if cell is large enough
        if (showValueText) {
          svg
            .append("text")
            .attr("x", (x(xLabels[j] || '') || 0) + x.bandwidth() / 2)
            .attr("y", (y(yLabels[i] || '') || 0) + y.bandwidth() / 2)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("fill", value > 0.7 ? "#000" : "#fff")
            .style("font-size", Math.min(14, cellSize / 3) + "px")
            .style("font-weight", "bold")
            .text(value.toFixed(2));
        }
      });
    });

    // Add "Not Displayed" text in the lower triangle
    svg
      .append("text")
      .attr("x", width / 4)
      .attr("y", (height * 3) / 4)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", "20px")
      .style("fill", "#999")
      .style("font-style", "italic")
      .text("Lower half not displayed");
  }, [data, xLabels, yLabels, leftValue, rightValue, onCellClick]);

  // Use efficient mouse tracking with native browser APIs and Floating UI
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !svgRef.current) return;

    function getElementCellData(element: Element | null): HoveredCell {
      if (!element) return null;

      // Check if this is a cell or we need to find a parent cell
      const cellElement =
        element.tagName.toLowerCase() === "rect"
          ? element
          : element.closest("rect");

      if (!cellElement) return null;

      const x = parseInt(cellElement.getAttribute("data-x") || "-1");
      const y = parseInt(cellElement.getAttribute("data-y") || "-1");
      const value = parseFloat(cellElement.getAttribute("data-value") || "0");

      if (x === -1 || y === -1) return null;

      // Get coordinates for the floating UI positioning
      const rect = cellElement.getBoundingClientRect();
      refs.setReference({
        getBoundingClientRect: () => rect,
        contextElement: cellElement,
      });

      return { x, y, value };
    }

    function resetCellStyles() {
      // Reset all cells to default style
      cellsRef.current.forEach(({ rect }) => {
        rect.style.stroke = "#f0f0f0";
        rect.style.strokeWidth = "0.5";
        rect.style.opacity = "0.9";
      });
    }

    function highlightCell(cell: HoveredCell) {
      resetCellStyles();

      if (!cell) return;

      // Find the cell in our map and highlight it
      const key = `${cell.y}-${cell.x}`;
      const cellData = cellsRef.current.get(key);

      if (cellData) {
        cellData.rect.style.stroke = "#000";
        cellData.rect.style.strokeWidth = "2";
        cellData.rect.style.opacity = "1";
      }
    }

    function handleMouseMove(e: MouseEvent) {
      // Get the element under the cursor
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const cell = getElementCellData(element);

      // If we're hovering over a new cell
      if (
        cell &&
        (!activeCell.current ||
          cell.x !== activeCell.current.x ||
          cell.y !== activeCell.current.y)
      ) {
        // Update active cell
        activeCell.current = cell;

        // Highlight the cell
        highlightCell(cell);

        // Update the floating UI positioning
        if (update) update();

        // Show tooltip with a slight delay
        setTimeout(() => {
          setShowTooltip(true);
        }, 150);
      } else if (!cell && activeCell.current) {
        // If we moved away from a cell
        activeCell.current = null;
        resetCellStyles();
        setShowTooltip(false);
      }
    }

    function handleMouseLeave() {
      activeCell.current = null;
      resetCellStyles();
      setShowTooltip(false);
    }

    // Attach event listeners
    container.addEventListener("mousemove", handleMouseMove);
    container.addEventListener("mouseleave", handleMouseLeave);

    // Clean up
    return () => {
      container.removeEventListener("mousemove", handleMouseMove);
      container.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [update]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg ref={svgRef} className="w-full"></svg>

      {/* Floating UI tooltip */}
      <TooltipProvider>
        <Tooltip open={showTooltip}>
          <TooltipContent
            ref={refs.setFloating}
            style={floatingStyles}
            className="bg-white border border-gray-200 text-gray-800 shadow-lg"
            sideOffset={5}
          >
            {activeCell.current && (
              <>
                <div className="font-medium">
                  Similarity Score: {activeCell.current.value.toFixed(4)}
                </div>
                <div className="text-gray-600 text-xs mt-1">
                  {xLabels[activeCell.current.x]} ↔{" "}
                  {yLabels[activeCell.current.y]}
                </div>
              </>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default function SimilarityMatrix() {
  const navigate = useNavigate({ from: "/" });
  const search = useSearch({ from: "/" });

  // Get initial values from URL search params
  const [isDraggingLeft, setIsDraggingLeft] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  // Get values from search params with defaults
  const { cohortId, runId, viewMode, leftValue, rightValue } = search;

  // Update URL search params when values change
  const updateSearchParams = useCallback(
    (
      params: Partial<{
        cohortId: string;
        runId: string;
        view: "matrix" | "list";
        left: number;
        right: number;
      }>,
    ) => {
      navigate({
        search: (prev) => ({
          ...prev,
          ...params,
        }),
        replace: true, // Replace instead of push to avoid cluttering history
      });
    },
    [navigate],
  );

  // Fetch cohorts with infinite cache
  const cohortsQuery = trpc.getCohorts.useQuery(undefined, {
    staleTime: Infinity, // Data never goes stale
    gcTime: Infinity, // Cache never expires
  });

  // Fetch runs based on selected cohort with infinite cache
  const runsQuery = trpc.getRunsByCohort.useQuery(cohortId, {
    enabled: cohortId !== "",
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Fetch similarity data based on selected run with infinite cache
  const similarityQuery = trpc.getSimilarityDataByRun.useQuery(runId, {
    enabled: runId !== "",
    staleTime: Infinity,
    gcTime: Infinity,
  });

  // Set labels and data based on query results
  const xLabels = similarityQuery.data?.students || [];
  const yLabels = similarityQuery.data?.students || [];
  const data = similarityQuery.data?.data || [];
  const defaulters = similarityQuery.data?.defaulters || [];

  // Calculate gradient colors based on slider positions
  const getBackgroundStyle = () => {
    return {
      background: `linear-gradient(to right,
        #4ade80 0%,
        #4ade80 ${leftValue * 100}%,
        #fbbf24 ${leftValue * 100}%,
        #fbbf24 ${rightValue * 100}%,
        #ef4444 ${rightValue * 100}%,
        #ef4444 100%)`,
    };
  };

  // Handle mouse/touch movement
  const handleMove = (clientX: number) => {
    if (!sliderRef.current) return;

    const rect = sliderRef.current.getBoundingClientRect();
    const sliderWidth = rect.width;
    const offsetX = clientX - rect.left;

    // Calculate new value (0 to 1)
    let newValue = Math.max(0, Math.min(1, offsetX / sliderWidth));

    // Round to nearest 0.01
    newValue = Math.round(newValue * 100) / 100;

    if (isDraggingLeft) {
      // Ensure left handle doesn't go beyond right handle
      if (newValue < rightValue) {
        updateSearchParams({ left: newValue });
      } else {
        updateSearchParams({ left: rightValue });
      }
    } else if (isDraggingRight) {
      // Ensure right handle doesn't go below left handle
      if (newValue > leftValue) {
        updateSearchParams({ right: newValue });
      } else {
        updateSearchParams({ right: leftValue });
      }
    }
  };

  // Mouse event handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingLeft || isDraggingRight) {
        handleMove(e.clientX);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingLeft, isDraggingRight]);

  // Touch event handlers
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if ((isDraggingLeft || isDraggingRight) && e.touches && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      setIsDraggingLeft(false);
      setIsDraggingRight(false);
    };

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDraggingLeft, isDraggingRight]);

  const handleCellClick = useCallback(
    (x: number, y: number) => {
      // Get the studentIds from indices
      const data = similarityQuery.data;
      if (!data || !('studentIds' in data) || !data.studentIds || !runId) return;

      const studentIdA = data.studentIds[y]; // y is the row index
      const studentIdB = data.studentIds[x]; // x is the column index

      // Create encoded parameter with runId and studentIds
      navigate({
        to: "/details/$pair",
        params: { pair: `${runId}:${studentIdA}:${studentIdB}` },
      });
    },
    [navigate, runId, similarityQuery.data],
  );

  const renderMatrix = () => (
    <div className="w-full overflow-x-auto h-full min-h-[800px]">
      <D3HeatMap
        data={data}
        xLabels={xLabels}
        yLabels={yLabels}
        leftValue={leftValue}
        rightValue={rightValue}
        onCellClick={handleCellClick}
      />
    </div>
  );

  // List component with optimized rendering
  const ListItem = ({
    i,
    j,
    value,
    xLabel,
    yLabel,
    leftValue,
    rightValue,
    onClick,
  }: {
    i: number;
    j: number;
    value: number;
    xLabel: string;
    yLabel: string;
    leftValue: number;
    rightValue: number;
    onClick: () => void;
  }) => {
    // Memoize color class for better performance
    const colorClass =
      value <= leftValue
        ? "bg-green-100 border-green-200"
        : value <= rightValue
          ? "bg-amber-100 border-amber-200"
          : "bg-red-100 border-red-200";

    // Each list item manages its own hover state
    const [isHovered, setIsHovered] = useState(false);
    const [showListTooltip, setShowListTooltip] = useState(false);
    const itemRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<number | null>(null);

    // Setup floating UI for the list item tooltip
    const { refs, floatingStyles } = useFloating({
      placement: "right",
      middleware: [offset(10), flip(), shift()],
      whileElementsMounted: autoUpdate,
    });

    // Handle mouse enter with delayed tooltip
    const handleMouseEnter = () => {
      setIsHovered(true);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setShowListTooltip(true);
      }, 150);
    };

    // Handle mouse leave
    const handleMouseLeave = () => {
      setIsHovered(false);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      setShowListTooltip(false);
    };

    // Clean up timeout on unmount
    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    return (
      <>
        <div
          ref={(node) => {
            // Set both refs
            itemRef.current = node;
            refs.setReference(node);
          }}
          className={`p-4 rounded-lg border flex justify-between items-center hover:shadow-md transition-shadow cursor-pointer ${colorClass} ${isHovered ? "ring-2 ring-black" : ""}`}
          style={{
            opacity: isHovered ? 1 : 0.9,
          }}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={onClick}
        >
          <div className="flex flex-col">
            <span className="font-medium text-gray-800">{`${xLabel} ↔ ${yLabel}`}</span>
            <span className="text-xs text-gray-500">
              Click to view comparison details
            </span>
          </div>
          <div className="flex items-center">
            <span className="text-xl font-bold px-3 py-1 rounded-full bg-white shadow-sm">
              {value.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Use shadcn tooltip for list items */}
        <TooltipProvider>
          <Tooltip open={showListTooltip}>
            <TooltipContent
              ref={refs.setFloating}
              style={floatingStyles}
              className="bg-white border border-gray-200 text-gray-800 shadow-lg"
              sideOffset={5}
            >
              <div className="font-medium">
                Similarity Score: {value.toFixed(4)}
              </div>
              <div className="text-gray-600 text-xs mt-1">
                {xLabel} ↔ {yLabel}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </>
    );
  };

  const renderList = () => {
    // Collect all pairs with their values for sorted rendering
    const pairs: { i: number; j: number; value: number }[] = [];

    data.forEach((row, i) => {
      row.forEach((value, j) => {
        // Only add pairs from upper triangle (above diagonal)
        if (i < j) {
          pairs.push({ i, j, value });
        }
      });
    });

    // Sort pairs by similarity value (descending)
    pairs.sort((a, b) => b.value - a.value);

    return (
      <div className="space-y-3">
        {/* Download CSV Button */}
        <div className="flex justify-end mb-4">
          <Button
            onClick={() => downloadCSV(data, xLabels, yLabels, runId || '')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download (CSV)
          </Button>
        </div>

        {/* List Items */}
        <div className="max-h-[800px] overflow-y-auto p-2">
          {pairs.length > 0 ? (
            pairs.map(({ i, j, value }) => (
              <ListItem
                key={`${i}-${j}`}
                i={i}
                j={j}
                value={value}
                xLabel={xLabels[i] || ''}
                yLabel={yLabels[j] || ''}
                leftValue={leftValue}
                rightValue={rightValue}
                onClick={() => handleCellClick(j, i)}
              />
            ))
          ) : (
            <div className="text-center p-6 text-gray-500">
              No similarity data to display
            </div>
          )}
        </div>
      </div>
    );
  };

  // Handle cohort selection
  const handleCohortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCohortId = e.target.value;
    updateSearchParams({
      cohortId: newCohortId,
      runId: "", // Reset run selection when cohort changes
    });
  };

  // Handle run selection
  const handleRunChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRunId = e.target.value;
    updateSearchParams({ runId: newRunId });
  };

  // Defaulters widget
  const renderDefaulters = () => {
    if (!defaulters.length) return null;
    return (
      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="font-semibold text-red-700 mb-2">Defaulters (No Submission)</div>
        <ul className="list-disc pl-6">
          {defaulters.map((s: any) => (
            <li key={s.studentId} className="text-red-800">
              <span className="font-mono">{s.regNo || s.studentId}</span>
              {s.name ? ` - ${s.name}` : ""}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[95%] lg:max-w-[90%] xl:max-w-[1600px] mx-auto p-4 md:p-8 space-y-6">
      {/* Selection section */}
      <div className="mb-8 bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Select Data</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cohort selection */}
          <div>
            <label
              htmlFor="cohort-select"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Cohort
            </label>
            <select
              id="cohort-select"
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={cohortId}
              onChange={handleCohortChange}
              disabled={cohortsQuery.isLoading}
            >
              <option value="">Select a cohort</option>
              {cohortsQuery.data?.map((cohort) => (
                <option key={cohort.cohortId} value={cohort.cohortId}>
                  {cohort.className}
                </option>
              ))}
            </select>
            {cohortsQuery.isLoading && (
              <p className="mt-1 text-sm text-gray-500">Loading cohorts...</p>
            )}
          </div>

          {/* Run selection */}
          <div>
            <label
              htmlFor="run-select"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Run
            </label>
            <select
              id="run-select"
              className="block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              value={runId}
              onChange={handleRunChange}
              disabled={runsQuery.isLoading || !cohortId}
            >
              <option value="">Select a run</option>
              {runsQuery.data?.map((run) => (
                <option key={run.runId} value={run.runId}>
                  {run.name || run.runId} (
                  {new Date(run.timestamp).toLocaleDateString()})
                </option>
              ))}
            </select>
            {runsQuery.isLoading && (
              <p className="mt-1 text-sm text-gray-500">Loading runs...</p>
            )}
          </div>
        </div>

        {similarityQuery.isLoading && (
          <div className="mt-4 text-center text-gray-500">
            Loading similarity data...
          </div>
        )}
      </div>

      {/* Slider section */}
      <div className="mb-8">
        <div className="w-full max-w-3xl mx-auto p-8 bg-white">
          {/* Scale markers */}
          <div className="flex justify-between text-sm font-medium">
            <span>0</span>
            <span>1</span>
          </div>

          <div className="mb-8 relative">
            {/* Slider track */}
            <div
              ref={sliderRef}
              className="h-4 rounded-full w-full relative"
              style={getBackgroundStyle()}
            >
              {/* Left handle */}
              <div
                className="absolute w-4 h-12 bg-white border-2 border-gray-300 rounded-sm cursor-grab active:cursor-grabbing shadow-md flex items-center justify-center"
                style={{
                  left: `${leftValue * 100}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                }}
                onMouseDown={() => setIsDraggingLeft(true)}
                onTouchStart={() => setIsDraggingLeft(true)}
              >
                <div className="w-1 h-6 bg-gray-300 rounded-full"></div>
              </div>
              {/* Left value */}
              <div
                className="absolute text-sm font-medium text-gray-700 top-full mt-4"
                style={{
                  left: `${leftValue * 100}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {leftValue.toFixed(2)}
              </div>

              {/* Right handle */}
              <div
                className="absolute w-4 h-12 bg-white border-2 border-gray-300 rounded-sm cursor-grab active:cursor-grabbing shadow-md flex items-center justify-center"
                style={{
                  left: `${rightValue * 100}%`,
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                }}
                onMouseDown={() => setIsDraggingRight(true)}
                onTouchStart={() => setIsDraggingRight(true)}
              >
                <div className="w-1 h-6 bg-gray-300 rounded-full"></div>
              </div>
              {/* Right value */}
              <div
                className="absolute text-sm font-medium text-gray-700 top-full mt-4"
                style={{
                  left: `${rightValue * 100}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {rightValue.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* View toggle buttons */}
      <div className="flex gap-4 justify-center mb-6">
        <Button
          variant={viewMode === "matrix" ? "default" : "outline"}
          onClick={() => updateSearchParams({ view: "matrix" })}
        >
          Matrix
        </Button>
        <Button
          variant={viewMode === "list" ? "default" : "outline"}
          onClick={() => updateSearchParams({ view: "list" })}
        >
          List
        </Button>
      </div>

      {/* Content */}
      <div className="bg-white p-4 md:p-6 rounded-lg shadow-lg min-h-[850px]">
        {renderDefaulters()}
        {cohortsQuery.isError ? (
          <div className="text-center p-12 text-red-500">
            Error loading cohorts: {cohortsQuery.error.message}
          </div>
        ) : runsQuery.isError && cohortId ? (
          <div className="text-center p-12 text-red-500">
            Error loading runs: {runsQuery.error.message}
          </div>
        ) : similarityQuery.isError && runId ? (
          <div className="text-center p-12 text-red-500">
            Error loading similarity data: {similarityQuery.error.message}
          </div>
        ) : !runId ? (
          <div className="flex items-center justify-center h-[800px] text-gray-500 text-lg">
            Please select a cohort and run to view the similarity matrix
          </div>
        ) : similarityQuery.isLoading ? (
          <div className="flex items-center justify-center h-[800px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading similarity data...</p>
            </div>
          </div>
        ) : data.length > 0 ? (
          viewMode === "matrix" ? (
            renderMatrix()
          ) : (
            renderList()
          )
        ) : (
          <div className="flex items-center justify-center h-[800px] text-gray-500 text-lg">
            No similarity data available for this run
          </div>
        )}
      </div>
    </div>
  );
}
