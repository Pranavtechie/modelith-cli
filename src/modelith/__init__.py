from pathlib import Path
import platformdirs
import platform




def get_platform():
    """Determine the current platform"""
    system: str = platform.system().lower()
    if system not in ["windows", "linux", "darwin"]:
        raise ValueError("Unsupported platform")
    else:
        return system

__all__ = [
    "ENV_FILE_PATH",
    "DATA_DIR_PATH",
    "CURRENT_PLATFORM",
]

# Define the .env.local file path
ENV_FILE_PATH: Path = Path(__file__).parent.parent.parent / ".env.local"

# Define the data directory path
APP_NAME = "modelith"
DATA_DIR_PATH: Path = Path(platformdirs.user_data_dir(appname=APP_NAME))

# Get current platform
CURRENT_PLATFORM: str = get_platform()

