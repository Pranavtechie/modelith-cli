from datetime import datetime
from sqlalchemy import insert, select
from modelith.core.db.generate_database import engine, Run, NotebookMetadata, Students
from typing import Dict, Any
import uuid
from rich.console import Console
import json

dbc = Console()

def insert_evaluation_run(folder_hash: str, notebook_data: Dict[str, Dict[str, Any]], class_id: uuid.UUID) -> str:
    """Insert a new evaluation run and its notebook data."""
    current_time = datetime.now()
    
    # Insert run metadata
    with engine.connect() as conn:

        run_id = uuid.uuid4()
        run_stmt = insert(table=Run).values(
            run_id=run_id,
            run_hash=folder_hash,
            timestamp=current_time,
            notebook_count=len(notebook_data),
            class_id=class_id
        )
        conn.execute(run_stmt)

        # Insert notebook metadata
        notebook_records = []
        for filename, notebook_data in notebook_data.items():
            # Convert ipynb_origin to the Enum type, handling None values
            ipynb_origin_value = notebook_data.get("ipynb_origin")
            
            # Fetch student_id based on filename
            student_id = None
            try:
                filename_upper = filename.upper()
                
                select_stmt = select(Students.student_id).where(Students.regno == filename_upper)
                result = conn.execute(select_stmt)
                student_id = result.scalar_one_or_none()
            except Exception as e:
                dbc.print(f"[red]Error fetching student_id for filename {filename}: {e}[/red]")
                continue
            

            notebook_record = {
                "notebook_id": uuid.uuid4(),
                "run_id": run_id,
                "filename": filename,
                "metadata_json": notebook_data.get("metadata"),
                "total_cells": notebook_data.get("total_cells"),
                "code_cells": notebook_data.get("code_cells"),
                "markdown_cells": notebook_data.get("markdown_cells"),
                "cell_execution_count": notebook_data.get("cell_execution_count"),
                "magic_command_usage": notebook_data.get("magic_command_usage"),
                "output_cells_count": notebook_data.get("output_cells_count"),
                "error_cell_count": notebook_data.get("error_cell_count"),
                "code_reusability_metric": notebook_data.get("code_reusability_metric"),
                "code_vs_markdown_ratio": notebook_data.get("code_vs_markdown_ratio"),
                "total_lines_of_code": notebook_data.get("total_lines_of_code"),
                "total_lines_in_markdown": notebook_data.get("total_lines_in_markdown"),
                "unique_imports": notebook_data.get("unique_imports"),
                "total_execution_time": notebook_data.get("total_execution_time"),
                "execution_time_delta_per_cell": notebook_data.get("execution_time_delta_per_cell"),
                "link_count": notebook_data.get("link_count"),
                "widget_usage": notebook_data.get("widget_usage"),
                "execution_order_disorder": notebook_data.get("execution_order_disorder"),
                "ast_node_count": notebook_data.get("ast_node_count"),
                "ast_depth": notebook_data.get("ast_depth"),
                "function_definitions_count": notebook_data.get("function_definitions_count"),
                "class_definitions_count": notebook_data.get("class_definitions_count"),
                "number_of_function_calls": notebook_data.get("number_of_function_calls"),
                "number_of_loop_constructs": notebook_data.get("number_of_loop_constructs"),
                "number_of_conditional_statements": notebook_data.get("number_of_conditional_statements"),
                "number_of_variable_assignments": notebook_data.get("number_of_variable_assignments"),
                "estimated_cyclomatic_complexity": notebook_data.get("estimated_cyclomatic_complexity"),
                "exception_handling_blocks_count": notebook_data.get("exception_handling_blocks_count"),
                "recursion_detection_status": notebook_data.get("recursion_detection_status"),
                "comprehension_count": notebook_data.get("comprehension_count"),
                "binary_operation_count": notebook_data.get("binary_operation_count"),
                "mean_identifier_length": notebook_data.get("mean_identifier_length"),
                "keyword_density": notebook_data.get("keyword_density"),
                "ipynb_origin": ipynb_origin_value,
                "student_id": student_id  # Include student_id
            }
            notebook_records.append(notebook_record)
            

        if notebook_records:
            metadata_stmt = insert(NotebookMetadata)
            conn.execute(metadata_stmt, notebook_records)
        
        conn.commit()
    
    return folder_hash
