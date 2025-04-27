import { createFileRoute } from "@tanstack/react-router";
import { trpc } from "../main";
import { useState } from "react";

export const Route = createFileRoute("/")({
	component: App,
});

function App() {
	const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
	
	// Use tRPC query to fetch projects
	const projectsQuery = trpc.getProjects.useQuery();
	
	// Query for selected project details (only runs when selectedProjectId is set)
	const projectDetailsQuery = trpc.getProjectById.useQuery(
		selectedProjectId as number,
		{ enabled: selectedProjectId !== null }
	);
	
	if (projectsQuery.isLoading) {
		return <div className="flex justify-center items-center h-screen">Loading projects...</div>;
	}
	
	if (projectsQuery.isError) {
		return <div className="text-red-500 flex justify-center items-center h-screen">Error: {projectsQuery.error.message}</div>;
	}
	
	return (
		<div className="max-w-4xl mx-auto p-6">
			<h1 className="text-3xl font-bold mb-6 text-center">Modelith Projects</h1>
			
			{selectedProjectId && projectDetailsQuery.data && (
				<div className="mb-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
					<div className="flex justify-between items-center mb-4">
						<h2 className="text-2xl font-bold">{projectDetailsQuery.data.name}</h2>
						<button 
							onClick={() => setSelectedProjectId(null)}
							className="text-gray-500 hover:text-gray-700"
						>
							Close
						</button>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div>
							<p className="text-gray-500">ID</p>
							<p className="font-medium">{projectDetailsQuery.data.id}</p>
						</div>
						<div>
							<p className="text-gray-500">Status</p>
							<p className={`font-medium ${
								projectDetailsQuery.data.status === "Active" 
									? "text-green-600" 
									: projectDetailsQuery.data.status === "Completed" 
										? "text-blue-600" 
										: "text-yellow-600"
							}`}>{projectDetailsQuery.data.status}</p>
						</div>
					</div>
				</div>
			)}
			
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{projectsQuery.data?.map((project) => (
					<div 
						key={project.id} 
						className="bg-white shadow-md rounded-lg p-6 hover:shadow-lg transition-shadow"
					>
						<h2 className="text-xl font-semibold mb-2">{project.name}</h2>
						<div className="flex justify-between items-center">
							<span 
								className={`px-3 py-1 rounded-full text-sm ${
									project.status === "Active" 
										? "bg-green-100 text-green-800" 
										: project.status === "Completed" 
											? "bg-blue-100 text-blue-800" 
											: "bg-yellow-100 text-yellow-800"
								}`}
							>
								{project.status}
							</span>
							<button 
								className="text-blue-600 hover:text-blue-800"
								onClick={() => setSelectedProjectId(project.id)}
							>
								View Details
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}