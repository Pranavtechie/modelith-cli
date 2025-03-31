from datetime import datetime
from sqlalchemy import insert
from modelith.core.generate_database import engine, Run, NotebookMetadata

def insert_evaluation_run(folder_hash: str, notebook_data) -> str:
    """Insert a new evaluation run and its notebook data."""
    current_time = datetime.now()
    
    # Insert run metadata
    with engine.connect() as conn:
        run_stmt = insert(Run).values(
            run_hash=folder_hash,
            timestamp=current_time,
            notebook_count=len(notebook_data)
        )
        conn.execute(run_stmt)
        
        # Insert notebook metadata
        notebook_records = [
            {
                "run_id": folder_hash,
                "filename": filename,
                "metadata_json": metadata
            }
            for filename, metadata in notebook_data.items()
        ]
        if notebook_records:
            metadata_stmt = insert(NotebookMetadata)
            conn.execute(metadata_stmt, notebook_records)
        
        conn.commit()
    
    return folder_hash
