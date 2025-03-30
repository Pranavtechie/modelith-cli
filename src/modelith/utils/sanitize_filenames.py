import os
import re
import shutil

def is_valid_filename(filename):
    """Check if the filename matches the required pattern."""
    pattern = r'^\d{2}[a-zA-Z]{3}\d{4}$'
    return bool(re.match(pattern, filename))

def extract_valid_part(filename):
    """Try to extract a valid pattern from the filename."""
    pattern = r'\d{2}[a-zA-Z]{3}\d{4}'
    match = re.search(pattern, filename)
    return match.group(0) if match else None

def sanitize_filenames(directory):
    """Process all .ipynb files in the current directory."""
    if directory == '' or directory is None:
        current_directory = os.getcwd()
    else:
        current_directory = os.path.abspath(directory)
    print(f"Scanning directory: {current_directory}")
    
    # Get all .ipynb files
    ipynb_files = [f for f in os.listdir(current_directory) if f.endswith('.ipynb')]
    print(f"Found {len(ipynb_files)} .ipynb files")
    
    # Dictionary to track new names and conflicts
    new_names = {}
    duplicates = {}
    
    # First pass: Determine new names
    for file in ipynb_files:
        base_name = os.path.splitext(file)[0]
        
        if is_valid_filename(base_name):
            # File already has a valid name
            new_name = file
        else:
            # Try to extract a valid pattern
            valid_part = extract_valid_part(base_name)
            if not valid_part:
                print(f"Warning: Could not extract valid pattern from {file}. Skipping...")
                continue
            
            new_name = f"{valid_part}.ipynb"
        
        if new_name in new_names.values() or (new_name != file and os.path.exists(os.path.join(current_directory, new_name))):
            # Handle conflict
            base = os.path.splitext(new_name)[0]
            count = 1
            while f"{base}({count}).ipynb" in new_names.values() or os.path.exists(os.path.join(current_directory, f"{base}({count}).ipynb")):
                count += 1
            
            new_names[file] = f"{base}({count}).ipynb"
            
            # Track duplicates
            if base not in duplicates:
                duplicates[base] = 1
            else:
                duplicates[base] += 1
        else:
            new_names[file] = new_name
    
    # Perform renaming
    for old_name, new_name in new_names.items():
        if old_name != new_name:
            old_path = os.path.join(current_directory, old_name)
            new_path = os.path.join(current_directory, new_name)
            shutil.move(old_path, new_path)
            print(f"Renamed: {old_name} → {new_name}")
    
    # Sanity check
    print("\n--- Sanity Check ---")
    ipynb_files_after = [f for f in os.listdir(current_directory) if f.endswith('.ipynb')]
    invalid_files = []
    
    for file in ipynb_files_after:
        base_name = os.path.splitext(file)[0]
        base_name_without_duplicates = re.sub(r'\(\d+\)$', '', base_name)  # Remove (1), (2), etc.
        
        if not is_valid_filename(base_name_without_duplicates):
            invalid_files.append(file)
    
    if invalid_files:
        print("Sanity check failed! The following files still have invalid names:")
        for file in invalid_files:
            print(f"- {file}")
    else:
        print("Sanity check passed! All files have valid names.")
    
    # Report duplicates
    if duplicates:
        print("\n--- Duplicate Files ---")
        for base_name, count in duplicates.items():
            print(f"- {base_name} has {count} duplicates")

if __name__ == "__main__":
    sanitize_filenames()
