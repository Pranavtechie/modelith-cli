"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import * as d3 from "d3";

import { createFileRoute, useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/similarity-matrix")({
	component: SimilarityMatrix,
});

// D3 Heatmap Component
const D3HeatMap = ({
	data,
	xLabels,
	yLabels,
	leftValue,
	rightValue,
	onCellClick,
	hoveredValue,
	setHoveredValue,
}: {
	data: number[][];
	xLabels: string[];
	yLabels: string[];
	leftValue: number;
	rightValue: number;
	onCellClick: (x: number, y: number) => void;
	hoveredValue: number | null;
	setHoveredValue: (value: number | null) => void;
}) => {
	const svgRef = useRef<SVGSVGElement>(null);

	useEffect(() => {
		if (!svgRef.current) return;

		// Clear previous content
		d3.select(svgRef.current).selectAll("*").remove();

		// Setup dimensions
		const margin = { top: 50, right: 50, bottom: 100, left: 100 };
		const width = 600 - margin.left - margin.right;
		const height = 600 - margin.top - margin.bottom;

		const svg = d3
			.select(svgRef.current)
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
			.append("g")
			.attr("transform", `translate(${margin.left},${margin.top})`);

		// Create scales
		const x = d3
			.scaleBand()
			.range([0, width])
			.domain(xLabels)
			.padding(0.05);
		const y = d3
			.scaleBand()
			.range([0, height])
			.domain(yLabels)
			.padding(0.05);

		// Color scale based on slider values
		const getColor = (value: number) => {
			if (value <= leftValue) return "#4ade80";
			if (value <= rightValue) return "#fbbf24";
			return "#ef4444";
		};

		// Add X axis labels
		svg.append("g")
			.style("font-size", "14px")
			.attr("transform", `translate(0,${height})`)
			.call(d3.axisBottom(x))
			.selectAll("text")
			.style("text-anchor", "end")
			.attr("dx", "-.8em")
			.attr("dy", ".15em")
			.attr("transform", "rotate(-65)");

		// Add Y axis labels
		svg.append("g").style("font-size", "14px").call(d3.axisLeft(y));

		// Create and update cells
		data.forEach((row, i) => {
			row.forEach((value, j) => {
				svg.append("rect")
					.attr("x", x(xLabels[j]) || 0)
					.attr("y", y(yLabels[i]) || 0)
					.attr("width", x.bandwidth())
					.attr("height", y.bandwidth())
					.style("fill", getColor(value))
					.style(
						"opacity",
						hoveredValue === value
							? 1
							: hoveredValue !== null
								? 0.5
								: 1
					)
					.style("cursor", "pointer")
					.on("mouseover", () => setHoveredValue(value))
					.on("mouseout", () => setHoveredValue(null))
					.on("click", () => onCellClick(j, i));

				// Add value text
				svg.append("text")
					.attr("x", (x(xLabels[j]) || 0) + x.bandwidth() / 2)
					.attr("y", (y(yLabels[i]) || 0) + y.bandwidth() / 2)
					.attr("text-anchor", "middle")
					.attr("dominant-baseline", "middle")
					.style("fill", "black")
					.style("font-size", "12px")
					.text(value.toFixed(2));
			});
		});
	}, [data, xLabels, yLabels, leftValue, rightValue, hoveredValue]);

	return <svg ref={svgRef}></svg>;
};

export default function SimilarityMatrix() {
	const navigate = useNavigate({ from: "/similarity-matrix" });
	const [leftValue, setLeftValue] = useState(0.3);
	const [rightValue, setRightValue] = useState(0.7);
	const [isDraggingLeft, setIsDraggingLeft] = useState(false);
	const [isDraggingRight, setIsDraggingRight] = useState(false);
	const [viewMode, setViewMode] = useState<"matrix" | "list">("matrix");
	const [hoveredValue, setHoveredValue] = useState<number | null>(null);
	const sliderRef = useRef<HTMLDivElement>(null);

	// Sample data - replace with your actual data
	const xLabels = [
		"21BAI1061.ast.json",
		"21BAI1074.ast.json",
		"21BAI1075.ast.json",
		"21BAI1076.ast.json",
	];
	const yLabels = [...xLabels];
	const data = [
		[1.0, 0.63, 0.92, 0.63],
		[0.63, 1.0, 0.6, 1.0],
		[0.92, 0.6, 1.0, 0.6],
		[0.63, 1.0, 0.6, 1.0],
	];

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
				setLeftValue(newValue);
			} else {
				setLeftValue(rightValue);
			}
		} else if (isDraggingRight) {
			// Ensure right handle doesn't go below left handle
			if (newValue > leftValue) {
				setRightValue(newValue);
			} else {
				setRightValue(leftValue);
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
			if (isDraggingLeft || isDraggingRight) {
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

	const handleCellClick = (x: number, y: number) => {
		navigate({
			to: "/details/$pair",
			params: { pair: `${x}-${y}` },
		});
	};

	const renderMatrix = () => (
		<div className="w-full overflow-x-auto flex justify-center">
			<D3HeatMap
				data={data}
				xLabels={xLabels}
				yLabels={yLabels}
				leftValue={leftValue}
				rightValue={rightValue}
				onCellClick={handleCellClick}
				hoveredValue={hoveredValue}
				setHoveredValue={setHoveredValue}
			/>
		</div>
	);

	const renderList = () => (
		<div className="space-y-2">
			{data.map((row, i) =>
				row.map((value, j) => (
					<div
						key={`${i}-${j}`}
						className="p-2 rounded bg-gray-100 flex justify-between"
						style={{
							opacity:
								hoveredValue === value
									? 1
									: hoveredValue !== null
										? 0.5
										: 1,
						}}
						onMouseEnter={() => setHoveredValue(value)}
						onMouseLeave={() => setHoveredValue(null)}
						onClick={() => handleCellClick(j, i)}
					>
						<span>{`${xLabels[i]} → ${yLabels[j]}`}</span>
						<span className="font-bold">{value.toFixed(2)}</span>
					</div>
				))
			)}
		</div>
	);

	return (
		<div className="w-full max-w-6xl mx-auto p-8 space-y-8">
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
					onClick={() => setViewMode("matrix")}
				>
					Matrix
				</Button>
				<Button
					variant={viewMode === "list" ? "default" : "outline"}
					onClick={() => setViewMode("list")}
				>
					List
				</Button>
			</div>

			{/* Content */}
			<div className="bg-white p-6 rounded-lg shadow">
				{viewMode === "matrix" ? renderMatrix() : renderList()}
			</div>
		</div>
	);
}
