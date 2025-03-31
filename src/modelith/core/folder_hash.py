import os
import subprocess
import hashlib

def generate_folder_hash(directory):
    """
    Generates a hash for all notebooks in a directory based on their filenames
    and last modification timestamps.

    Args:
        directory (str): The directory to scan for .ipynb files.

    Returns:
        str: A SHA-256 hash of the concatenated filenames and modification timestamps.
    """
    notebook_files = sorted([f for f in os.listdir(directory) if f.endswith(".ipynb")])
    
    if not notebook_files:
        return None  # Or raise an exception, depending on desired behavior

    combined_string = ""
    for filename in notebook_files:
        filepath = os.path.join(directory, filename)
        try:
            # Extract last modification timestamp using exiftool
            result = subprocess.run(
                ["exiftool", "-FileModifyDate", "-d", "%Y-%m-%d %H:%M:%S", "-s3", filepath],
                capture_output=True,
                text=True,
                check=True
            )
            if result.stdout.strip():
                timestamp = result.stdout.strip()
            else:
                timestamp = "None"  # Or some other default value
        except subprocess.CalledProcessError as e:
            print(f"Error extracting timestamp from {filename}: {e}")
            continue  # Skip to the next file

        combined_string += f"{filename}-{timestamp}:"

    # Generate SHA-256 hash of the combined string
    if combined_string:
        hash_object = hashlib.sha256(combined_string.encode())
        hex_dig = hash_object.hexdigest()
        return hex_dig
    else:
        return None