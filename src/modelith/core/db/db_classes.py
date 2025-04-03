from sqlalchemy import insert, select, Table, Column, String, ForeignKey, MetaData
from sqlalchemy.dialects.postgresql import UUID
from modelith.core.db.generate_database import engine, Classes, Students
import pandas as pd
from typing import List, Dict
import uuid

def create_class(class_name: str) -> None:
    """Create a new class in the database."""
    with engine.connect() as conn:
        stmt = insert(Classes).values(
            class_id=uuid.uuid4(),
            class_name=class_name
        )
        conn.execute(stmt)
        conn.commit()

def fetch_classes():
    """Fetch all classes from the database."""
    with engine.connect() as conn:
        stmt = select(Classes)
        result = conn.execute(stmt)
        
        classes = [
            {
                "class_id": row.class_id,
                "class_name": row.class_name
            }
            for row in result.mappings()
        ]
        return classes

def fetch_class_id_from_class_name(class_name: str) -> uuid.UUID:
    """Fetch the class_id from the database based on the class_name."""
    with engine.connect() as conn:
        stmt = select(Classes.class_id).where(Classes.class_name == class_name)
        result = conn.execute(stmt).first()
        if not result:
            raise ValueError(f"Class '{class_name}' not found")
        return result[0]

def upload_class_data(class_name: str, csv_path: str) -> None:
    """Upload student data from CSV to the database for a specific class."""
    # Read CSV with proper handling of whitespace
    df = pd.read_csv(csv_path, skipinitialspace=True)
    
    # Check if required columns are missing
    if 'regno' not in df.columns or 'name' not in df.columns:
        raise ValueError("CSV must contain 'regno' and 'name' columns")

    with engine.connect() as conn:
        # Get class_id for the given class_name
        stmt = select(Classes.class_id).where(Classes.class_name == class_name)
        result = conn.execute(stmt).first()
        if not result:
            raise ValueError(f"Class '{class_name}' not found")
        class_id = result[0]

        # Insert student data
        for _, row in df.iterrows():
            stmt = insert(Students).values(
                student_id=uuid.uuid4(),
                class_id=class_id,
                regno=row['regno'].strip(),  # Remove any extra whitespace
                name=row['name'].strip()     # Remove any extra whitespace
            )
            conn.execute(stmt)
        
        conn.commit()

