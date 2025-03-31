from typer.main import Typer
import typer
from rich.console import Console
import os
import shutil
import json
from typing_extensions import LiteralString
from modelith.core.sanity_check import sanity_check
from modelith.core.folder_hash import generate_folder_hash
from modelith.core.notebook_analyzer import NotebookAnalyzer
from modelith.core.db_operations import insert_evaluation_run
from modelith.core.ast_comparison import compare_asts_in_folder


console = Console()

def add_commands(app: Typer): 

    @app.command()
    def extract(folder: str = typer.Option(".", "--folder", "-f", help="Folder to scan for .ipynb files")):
        """Evaluate all .ipynb files in the specified folder and save results."""
        # STEP 0: Sanity Check - Verification if Existing Resources are in-place
        if not sanity_check():
            console.print(f"[red]Operation cancelled[/red]")

        
        # STEP 1: Validate input folder
        folder = os.path.abspath(folder)
        if not os.path.exists(folder) or not os.path.isdir(folder):
            console.print(f"[red]Error: '{folder}' is not a valid directory.[/red]")
            raise typer.Exit(1)
        
        # STEP 2: Generate hash for the folder
        folder_hash = generate_folder_hash(folder)
        if not folder_hash:
            console.print("No notebook files found in the specified folder.")
            return

        # STEP 3: Get Notebook Files and create evaluation dictionary (dumped to evaluation.json)
        nb_files: list[str] = [os.path.join(folder, f) for f in os.listdir(folder) if f.endswith('.ipynb')]
        evaluations = {
            "folder_hash": folder_hash,
            "notebooks": {}
        }

        # STEP 4: Check if evaluation directory exists and handle conflicts
        eval_dir = "evaluation"

        if os.path.exists(eval_dir) and os.listdir(eval_dir):
            console.print(f"The directory '{eval_dir}' is not empty.")
            response = typer.confirm("Do you want to overwrite the contents?", abort=False)
            if response:
                for filename in os.listdir(eval_dir):
                    file_path = os.path.join(eval_dir, filename)
                    try:
                        if os.path.isfile(file_path) or os.path.islink(file_path):
                            os.unlink(file_path)
                        elif os.path.isdir(file_path):
                            shutil.rmtree(file_path)
                    except Exception as e:
                        console.print(f"Failed to delete {file_path}. Reason: {e}")
                        return
                console.print(f"All files in '{eval_dir}' have been deleted.")
            else:
                console.print("Evaluation cancelled.")
                return

        if not os.path.exists(eval_dir):
            os.makedirs(eval_dir)

        # STEP 5: Generate metrics for every individual JupyterNotebook File & Generate AST
        for nb in nb_files:
            try:
                analyzer: NotebookAnalyzer = NotebookAnalyzer(notebook_file=nb)
                key = os.path.splitext(os.path.basename(nb))[0]
                evaluations["notebooks"][key] = analyzer.get_metrics()
            except Exception as e:
                key = os.path.splitext(os.path.basename(nb))[0]
                evaluations["notebooks"][key] = {"error": str(e)}

        # STEP 6: Store the Metrics Generated in the sqlite database
        try:
            run_id = insert_evaluation_run(folder_hash, notebook_data=evaluations["notebooks"])
            console.print(f"[green]Successfully stored evaluation results in database. Run ID: {run_id}[/green]")
        except Exception as e:
            console.print(f"[red]Failed to store results in database: {e}[/red]")
        
        # STEP 7: Also store the data from evaluation dictionary to evaluation.json file 
        output_file: LiteralString = os.path.join(eval_dir, "evaluation.json")
        with open(file=output_file, mode="w") as f:
            json.dump(obj=evaluations, fp=f, indent=2)
        
        console.print(f"Scanned folder: {folder}")
        console.print(f"Evaluation results saved to {output_file}\n")


        # STEP 8: Perform AST Comparison and generate heatmap and ast_results.json
        compare_asts_in_folder(folder_path=eval_dir)
