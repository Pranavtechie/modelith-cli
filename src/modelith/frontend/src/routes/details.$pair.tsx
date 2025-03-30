import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/details/$pair")({
	validateSearch: (search: Record<string, unknown>) => ({}),
	component: DetailsPage,
});

function DetailsPage() {
	const { pair } = Route.useParams();
	const [file1Index, file2Index] = pair.split("-").map(Number);

	// Sample data - replace with your actual data fetch logic
	const files = [
		"21BAI1061.ast.json",
		"21BAI1074.ast.json",
		"21BAI1075.ast.json",
		"21BAI1076.ast.json",
	];

	const file1 = files[file1Index];
	const file2 = files[file2Index];

	return (
		<div className="container mx-auto p-8">
			<h1 className="text-2xl font-bold mb-6">Comparison Details</h1>

			<div className="bg-white rounded-lg shadow p-6">
				<div className="grid grid-cols-2 gap-4">
					<div className="p-4 bg-gray-50 rounded-lg">
						<h2 className="text-lg font-semibold mb-2">File 1</h2>
						<p className="text-gray-700">{file1}</p>
					</div>

					<div className="p-4 bg-gray-50 rounded-lg">
						<h2 className="text-lg font-semibold mb-2">File 2</h2>
						<p className="text-gray-700">{file2}</p>
					</div>
				</div>

				{/* Add more comparison details here */}
				<div className="mt-6 p-4 bg-gray-50 rounded-lg">
					<h2 className="text-lg font-semibold mb-2">
						Comparison Results
					</h2>
					<p className="text-gray-700">
						Detailed comparison results between {file1} and {file2}{" "}
						will be shown here.
					</p>
				</div>
			</div>
		</div>
	);
}
