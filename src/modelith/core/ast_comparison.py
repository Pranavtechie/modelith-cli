import ast
import json
import os
import matplotlib.pyplot as plt
import numpy as np

def are_asts_equivalent(node1, node2, ignore_variable_names=False):
    """
    Compares two AST nodes for equivalence.
    """

    if type(node1) != type(node2):
        return False

    match node1:
        case ast.Name():
            if ignore_variable_names:
                return True
            else:
                return node1.id == node2.id
        case ast.Constant():
            return node1.value == node2.value
        case ast.BinOp():
            if node1.op == node2.op:
                # Handle commutative operators
                if isinstance(node1.op, (ast.Add, ast.Mult)):
                    return (are_asts_equivalent(node1.left, node2.left, ignore_variable_names) and
                            are_asts_equivalent(node1.right, node2.right, ignore_variable_names)) or \
                            (are_asts_equivalent(node1.left, node2.right, ignore_variable_names) and
                            are_asts_equivalent(node1.right, node2.left, ignore_variable_names))
                else:
                    return (are_asts_equivalent(node1.left, node2.left, ignore_variable_names) and
                            are_asts_equivalent(node1.right, node2.right, ignore_variable_names))
            else:
                return False
        case ast.FunctionDef():
            return (node1.name == node2.name and
                    are_asts_equivalent(node1.args, node2.args, ignore_variable_names) and
                    are_asts_equivalent(node1.body, node2.body, ignore_variable_names))
        case ast.Return():
            return are_asts_equivalent(node1.value, node2.value, ignore_variable_names)
        case ast.Module():
            if len(node1.body) != len(node2.body):
                return False
            for i in range(len(node1.body)):
                if not are_asts_equivalent(node1.body[i], node2.body[i], ignore_variable_names):
                    return False
            return True
        case _:
            # Handle other node types or raise an exception
            return False

def calculate_normalized_similarity(edit_distance, max_distance):
    """
    Calculates a normalized similarity score (0 to 1) based on the edit distance
    and the estimated maximum possible distance.
    """
    similarity = 1 - (edit_distance / max_distance)
    return max(0, similarity)  # Clamp to 0 if similarity is negative

def load_asts_from_json(folder_path):
    """
    Loads ASTs from .ast.json files in the given folder.
    Returns a dictionary where keys are file names and values are AST objects.
    """
    asts = {}
    for filename in os.listdir(folder_path):
        if filename.endswith(".ast.json"):
            filepath = os.path.join(folder_path, filename)
            with open(filepath, 'r') as f:
                try:
                    data = json.load(f)
                    ast_dict = data.get("ast")  # Extract the AST dictionary
                    if ast_dict:
                        asts[filename] = _dict_to_ast(ast_dict)
                    else:
                        print(f"Warning: No AST found in {filename}. Skipping.")
                except json.JSONDecodeError:
                    print(f"Warning: Could not decode JSON in {filename}. Skipping.")
                except TypeError as e:
                    print(f"Warning: Type error while creating AST from {filename}: {e}. Skipping.")
                except Exception as e:
                    print(f"Warning: An unexpected error occurred while processing {filename}: {e}. Skipping.")
    return asts

def _dict_to_ast(data):
    """
    Converts a dictionary representation to an AST node.
    """
    if isinstance(data, dict):
        node_type = data.get('_type')
        if node_type:
            data_copy = data.copy()
            data_copy.pop('_type')
            node_class = getattr(ast, node_type, None)
            if node_class:
                try:
                    return node_class(**{
                        k: _dict_to_ast(v) for k, v in data_copy.items()
                    })
                except TypeError as e:
                    print(f"TypeError creating {node_type}: {e}")
                    return None
            else:
                print(f"Warning: Unknown node type {node_type}")
                return None
    elif isinstance(data, list):
        return [_dict_to_ast(item) for item in data]
    else:
        return data

def calculate_tree_edit_distance(node1, node2):
    """
    Calculates a simple tree edit distance between two AST nodes.
    This is a placeholder and should be replaced with a more sophisticated algorithm.
    """
    if type(node1) != type(node2):
        return 1  # Different node types, distance of 1
    
    distance = 0
    
    # Compare attributes based on node type
    if isinstance(node1, ast.Name):
        if node1.id != node2.id:
            distance += 1
    elif isinstance(node1, ast.Constant):
        if node1.value != node2.value:
            distance += 1
    elif isinstance(node1, ast.BinOp):
        distance += calculate_tree_edit_distance(node1.left, node2.left)
        distance += calculate_tree_edit_distance(node1.right, node2.right)
        if type(node1.op) != type(node2.op):
            distance += 1
    elif isinstance(node1, ast.Module):
        max_len = max(len(node1.body), len(node2.body))
        distance += abs(len(node1.body) - len(node2.body))
        for i in range(min(len(node1.body), len(node2.body))):
            distance += calculate_tree_edit_distance(node1.body[i], node2.body[i])
    # Add more node type comparisons as needed
    
    return distance

def compare_asts_in_folder(folder_path):
    """
    Compares ASTs from .ast.json files in the given folder,
    generates a plot, and stores results in a JSON file.
    Only computes unique comparisons to avoid duplicate computation.
    """
    asts = load_asts_from_json(folder_path)
    filenames = sorted(list(asts.keys()))  # Sort filenames for consistent ordering
    num_asts = len(filenames)

    if num_asts < 2:
        print("Need at least two AST files for comparison.")
        return

    # Initialize matrices with proper identity values
    similarity_scores = np.eye(num_asts)  # Identity matrix for similarity (diagonal=1)
    edit_distances = np.zeros((num_asts, num_asts))  # Zeros matrix for distances
    max_distance = 100  # Estimate maximum possible edit distance
    results = []

    # Process all unique pairs
    for i in range(num_asts):
        for j in range(i+1, num_asts):  # Only process unique pairs where i < j
            ast1 = asts[filenames[i]]
            ast2 = asts[filenames[j]]

            distance = calculate_tree_edit_distance(ast1, ast2)
            similarity = calculate_normalized_similarity(distance, max_distance)

            # Store both in the matrix (i,j) and (j,i) for symmetric matrix
            edit_distances[i, j] = edit_distances[j, i] = distance
            similarity_scores[i, j] = similarity_scores[j, i] = similarity

            results.append({
                "file1": filenames[i],
                "file2": filenames[j],
                "edit_distance": distance,
                "similarity": similarity
            })

    # Generate heatmap plot
    plt.figure(figsize=(10, 8))
    cmap = plt.get_cmap('viridis')
    plt.imshow(similarity_scores, cmap=cmap, interpolation='nearest')
    plt.colorbar(label='Similarity Score')
    plt.xticks(range(num_asts), filenames, rotation=45, ha="right")
    plt.yticks(range(num_asts), filenames)
    plt.title('AST Similarity Heatmap')
    
    # Add text annotations for better readability
    # for i in range(num_asts):
    #     for j in range(num_asts):
    #         # Only annotate if similarity is not 1.0 (not the diagonal)
    #         if i != j:
    #             plt.text(j, i, f'{similarity_scores[i, j]:.2f}', 
    #                     ha="center", va="center", 
    #                     color="white" if similarity_scores[i, j] < 0.7 else "black")
    
    plt.tight_layout()
    plt.savefig('ast_similarity_heatmap.png', dpi=500)
    plt.close()

    # Store results in a JSON file
    results_filename = "ast_comparison_results.json"
    with open(results_filename, 'w') as f:
        json.dump(results, f, indent=4)

    print(f"AST comparison complete. Results stored in {results_filename} and heatmap saved to ast_similarity_heatmap.png")
