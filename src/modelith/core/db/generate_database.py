from sqlalchemy import create_engine, Column, String, Integer, Float, ForeignKey, DateTime, JSON, Uuid, Boolean, Enum
from sqlalchemy.orm import declarative_base
from modelith import DATA_DIR_PATH

Base = declarative_base()
url = f'sqlite:///{DATA_DIR_PATH}/modelith.db'
engine = create_engine(url=url)

class Run(Base):
    __tablename__ = 'runs'
    run_id = Column(Uuid, primary_key=True)
    run_hash = Column(String)
    timestamp = Column(DateTime, nullable=False)
    notebook_count = Column(Integer, nullable=False)
    class_id = Column(Uuid, ForeignKey('classes.class_id'))

class NotebookMetadata(Base):
    __tablename__ = 'notebook_metadata'
    notebook_id = Column(Uuid, primary_key=True)
    run_id = Column(Uuid, ForeignKey('runs.run_id'))
    filename = Column(String, nullable=False)
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
    student_id = Column(Uuid, ForeignKey('students.student_id'))
    
class Similarity(Base):
    __tablename__ = 'similarities'
    
    run_id = Column(Uuid, ForeignKey('runs.run_id'))
    file_a = Column(String, nullable=False, primary_key=True)
    file_b = Column(String, nullable=False, primary_key=True)
    similarity_score = Column(Float, nullable=False)
    tree_edit_distance = Column(Float, nullable=False)

class Classes(Base):
    __tablename__ = 'classes'

    class_id = Column(Uuid, primary_key=True)
    class_name = Column(String, unique=True)

class Students(Base):
    __tablename__ = 'students'

    student_id = Column(Uuid, primary_key=True)
    class_id = Column(Uuid, ForeignKey('classes.class_id'))
    name = Column(String)
    regno = Column(String)

def generate_database():
    Base.metadata.create_all(engine)
    return True
