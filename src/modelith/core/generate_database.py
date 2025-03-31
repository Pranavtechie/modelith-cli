from sqlalchemy import create_engine, Column, String, Integer, Float, ForeignKey, DateTime, JSON, Uuid, Boolean, Enum
from sqlalchemy.orm import declarative_base
import os

engine = create_engine('sqlite:///modelith.db')
Base = declarative_base()

class Run(Base):
    __tablename__ = 'runs'
    
    run_hash = Column(String, primary_key=True)
    timestamp = Column(DateTime, nullable=False)
    notebook_count = Column(Integer, nullable=False)

class NotebookMetadata(Base):
    __tablename__ = 'notebook_metadata'
    
    run_id = Column(Uuid, ForeignKey('runs.run_hash'), primary_key=True)
    filename = Column(String, nullable=False, primary_key=True)
    total_cells = Column(Integer)
    code_cells = Column(Integer)
    markdown_cells = Column(Integer)
    cell_execution_count = Column(JSON)
    magic_command_usage = Column(Integer)
    output_cells_count = Column(Integer)
    error_cell_count = Column(Integer)
    code_reusability_metric = Column(Float)
    code_vs_markdown_ratio = Column(Float)
    total_lines_of_code = Column(Integer)
    total_lines_in_markdown = Column(Integer)
    unique_imports = Column(Integer)
    total_execution_time = Column(Float)
    execution_time_delta_per_cell = Column(JSON)
    link_count = Column(Integer)
    widget_usage = Column(Integer)
    execution_order_disorder = Column(Boolean)
    ast_node_count = Column(Integer)
    ast_depth = Column(Integer)
    function_definitions_count = Column(Integer)
    class_definitions_count = Column(Integer)
    number_of_function_calls = Column(Integer)
    number_of_loop_constructs = Column(Integer)
    number_of_conditional_statements = Column(Integer)
    number_of_variable_assignments = Column(Integer)
    estimated_cyclomatic_complexity = Column(Integer)
    exception_handling_blocks_count = Column(Integer)
    recursion_detection_status = Column(Boolean)
    comprehension_count = Column(Integer)
    binary_operation_count = Column(Integer)
    mean_identifier_length = Column(Float)
    keyword_density = Column(Float)
    metadata_json = Column(JSON)
    ipynb_origin = Column(Enum("google-colab", "kaggle", "jupyter", name="ipynb_origin_enum"))
    
class Similarity(Base):
    __tablename__ = 'similarities'
    
    run_id = Column(Uuid, ForeignKey('runs.run_hash'), primary_key=True)
    file_a = Column(String, nullable=False, primary_key=True)
    file_b = Column(String, nullable=False, primary_key=True)
    similarity_score = Column(Float, nullable=False)
    tree_edit_distance = Column(Float, nullable=False)

def generate_database(path):
    if not os.path.exists(path):
        Base.metadata.create_all(engine)
        return True
    else:
        return False