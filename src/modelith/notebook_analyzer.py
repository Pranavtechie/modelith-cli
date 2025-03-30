import os
import re
import json
import ast
import keyword
import subprocess
from jupyter_notebook_parser import JupyterNotebookParser

class NotebookAnalyzer:
    def __init__(self, notebook_file: str):
        self.notebook_file = notebook_file
        self.parser = JupyterNotebookParser(notebook_file)
        self.all_cells = self.parser.get_all_cells() or []
        self.code_cells = self.parser.get_code_cells() or []
        self.markdown_cells = self.parser.get_markdown_cells() or []
        self.metrics = {}
        self.analyze()

    def _extract_metadata(self):
        try:
            result = subprocess.run(['exiftool', self.notebook_file], capture_output=True, text=True)
            metadata = result.stdout
            output_dict = {}
            lines = metadata.split('\n')
            for line in lines:
                if ':' in line:
                    index = line.find(':')
                    key, value = line[:index].strip(), line[index+1:].strip()
                    output_dict[key] = value
            return output_dict
        except Exception as e:
            print(f"Error extracting metadata: {e}")
            return {}

    def _determine_ipynb_origin(self):
        try:
            notebook_content = self.parser.notebook_content
            metadata = notebook_content.get('metadata', {})

            if 'colab' in metadata:
                return "google-colab"
            elif 'kaggle' in metadata:
                return "kaggle"
            else:
                return "jupyter"
        except Exception as e:
            print(f"Error determining ipynb origin: {e}")
            return "jupyter"

    def analyze(self):
        analytics = {}

        # Basic Notebook Stats
        analytics["notebook"] = self.notebook_file
        analytics["total_cells"] = len(self.all_cells)
        analytics["code_cells"] = len(self.code_cells)
        analytics["markdown_cells"] = len(self.markdown_cells)

        # Process Code Cells
        code_sources = []
        cell_execution_counts = []
        error_cell_count = 0
        magic_usage = 0
        output_cells_count = 0
        duplicate_count = 0
        unique_sources = set()
        total_code_lines = 0

        for cell in self.code_cells:
            source = cell.get("source", "")
            # Handle case when source is a list
            if isinstance(source, list):
                source = "".join(source)
            code_sources.append(source)
            total_code_lines += len(source.splitlines())
            # Duplicate code segments detection (simple duplicate source string)
            if source in unique_sources:
                duplicate_count += 1
            else:
                unique_sources.add(source)
            # Execution counts if available
            exec_count = cell.get("execution_count")
            if exec_count is not None:
                cell_execution_counts.append(exec_count)
            # Count magic commands (lines starting with '%')
            for line in source.splitlines():
                if line.strip().startswith('%'):
                    magic_usage += 1
            # Count outputs and errors
            outputs = cell.get("outputs", [])
            output_cells_count += len(outputs)
            for out in outputs:
                if out.get("output_type") == "error":
                    error_cell_count += 1

        analytics["cell_execution_count"] = cell_execution_counts
        analytics["magic_command_usage"] = magic_usage
        analytics["output_cells_count"] = output_cells_count
        analytics["error_cell_count"] = error_cell_count
        analytics["code_reusability_metric"] = duplicate_count

        # Code vs Markdown Ratio
        analytics["code_vs_markdown_ratio"] = (
            len(self.code_cells) / len(self.markdown_cells)
            if self.markdown_cells else None
        )

        # Total lines in code and markdown cells
        analytics["total_lines_of_code"] = total_code_lines
        analytics["total_lines_in_markdown"] = sum(
            len(("".join(cell.get("source", "")) if isinstance(cell.get("source", ""), list) else cell.get("source", "")).splitlines())
            for cell in self.markdown_cells
        )

        # Unique Imports (Regex for import/from statements)
        imports = set()
        for source in code_sources:
            found = re.findall(r'^\s*(?:import|from)\s+([\w\.]+)', source, re.MULTILINE)
            imports.update(found)
        analytics["unique_imports"] = len(imports)

        # Dummy values for execution time metrics as they are not available
        analytics["total_execution_time"] = None
        analytics["execution_time_delta_per_cell"] = []

        # Process Markdown Cells for Link Count
        link_pattern = re.compile(r'https?://\S+')
        markdown_text = "\n".join(
            ( "".join(cell.get("source", "")) if isinstance(cell.get("source", ""), list) else cell.get("source", "") )
            for cell in self.markdown_cells
        )
        analytics["link_count"] = len(link_pattern.findall(markdown_text))

        # Widget Usage (simple check for ipywidgets)
        widget_pattern = re.compile(r'ipywidgets')
        widget_usage = 0
        for source in code_sources:
            if widget_pattern.search(source):
                widget_usage += 1
        analytics["widget_usage"] = widget_usage

        # Execution Order Disorder: Check if execution counts are not strictly increasing
        if cell_execution_counts:
            disorder = any(
                earlier > later 
                for earlier, later in zip(cell_execution_counts, cell_execution_counts[1:])
            )
        else:
            disorder = None
        analytics["execution_order_disorder"] = disorder

        # Concatenate full code for AST analysis
        full_code = "\n".join(code_sources)
        try:
            tree = ast.parse(full_code)
        except SyntaxError:
            tree = None

        if tree:
            analytics["ast_node_count"] = sum(1 for _ in ast.walk(tree))
            analytics["ast_depth"] = self._compute_ast_depth(tree)
            analytics["function_definitions_count"] = self._count_nodes(tree, ast.FunctionDef)
            analytics["class_definitions_count"] = self._count_nodes(tree, ast.ClassDef)
            analytics["number_of_function_calls"] = self._count_nodes(tree, ast.Call)
            analytics["number_of_loop_constructs"] = self._count_nodes(tree, (ast.For, ast.While))
            analytics["number_of_conditional_statements"] = self._count_nodes(tree, ast.If)
            analytics["number_of_variable_assignments"] = self._count_nodes(tree, (ast.Assign, ast.AugAssign))
            analytics["estimated_cyclomatic_complexity"] = (
                analytics["number_of_conditional_statements"]
                + analytics["number_of_loop_constructs"]
            )
            analytics["exception_handling_blocks_count"] = self._count_nodes(tree, ast.Try)
            analytics["recursion_detection_status"] = self._detect_recursion(tree)
            analytics["comprehension_count"] = self._count_nodes(tree, (ast.ListComp, ast.DictComp, ast.SetComp, ast.GeneratorExp))
            analytics["binary_operation_count"] = self._count_nodes(tree, ast.BinOp)
            # Mean Identifier Length from variables, function names, and class names
            identifiers = []
            for node in ast.walk(tree):
                if isinstance(node, ast.Name):
                    identifiers.append(len(node.id))
                elif isinstance(node, (ast.FunctionDef, ast.ClassDef)):
                    identifiers.append(len(node.name))
            analytics["mean_identifier_length"] = sum(identifiers) / len(identifiers) if identifiers else 0
            # Keyword Density
            keyword_count = sum(full_code.count(kw) for kw in keyword.kwlist)
            total_lines = len(full_code.splitlines())
            analytics["keyword_density"] = keyword_count / total_lines if total_lines else 0

            # Save AST to file
            notebook_name = os.path.splitext(os.path.basename(self.notebook_file))[0]
            ast_filename = os.path.join("evaluation", f'{notebook_name}.ast.json')
            if not os.path.exists("evaluation"):
                os.makedirs("evaluation")
            with open(ast_filename, 'w') as f:
                json.dump({"ast": self._ast_to_dict(tree)}, f, indent=2)
        else:
            analytics["ast_node_count"] = None
            analytics["ast_depth"] = None
            analytics["function_definitions_count"] = None
            analytics["class_definitions_count"] = None
            analytics["number_of_function_calls"] = None
            analytics["number_of_loop_constructs"] = None
            analytics["number_of_conditional_statements"] = None
            analytics["number_of_variable_assignments"] = None
            analytics["estimated_cyclomatic_complexity"] = None
            analytics["exception_handling_blocks_count"] = None
            analytics["recursion_detection_status"] = None
            analytics["comprehension_count"] = None
            analytics["binary_operation_count"] = None
            analytics["mean_identifier_length"] = None
            analytics["keyword_density"] = None

        # Extract and include metadata
        analytics["metadata"] = self._extract_metadata()

        # Determine ipynb origin
        analytics["ipynb_origin"] = self._determine_ipynb_origin()

        # Remove the AST from the metrics
        # analytics["ast"] = self._ast_to_dict(tree) if tree else None

        self.metrics = analytics

    def _compute_ast_depth(self, node):
        if not list(ast.iter_child_nodes(node)):
            return 1
        return 1 + max(self._compute_ast_depth(child) for child in ast.iter_child_nodes(node))

    def _count_nodes(self, tree, node_type):
        count = 0
        for node in ast.walk(tree):
            if isinstance(node, node_type):
                count += 1
        return count

    def _detect_recursion(self, tree):
        # For each function, check if it calls itself
        for node in ast.walk(tree):
            if isinstance(node, ast.FunctionDef):
                func_name = node.name
                for subnode in ast.walk(node):
                    if isinstance(subnode, ast.Call):
                        if isinstance(subnode.func, ast.Name) and subnode.func.id == func_name:
                            return True
        return False

    def _ast_to_dict(self, node):
        """
        Converts an AST node to a dictionary representation.
        """
        if isinstance(node, ast.AST):
            fields = {
                key: self._ast_to_dict(value)
                for key, value in ast.iter_fields(node)
            }
            return {
                '_type': node.__class__.__name__,
                **fields
            }
        elif isinstance(node, list):
            return [self._ast_to_dict(item) for item in node]
        else:
            return node

    def get_metrics(self):
        return self.metrics

    def to_json(self):
        return json.dumps(self.metrics, indent=2)
