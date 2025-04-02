import subprocess
import platform
from pathlib import Path
from typing import Dict, Literal
import typer
from rich.console import Console
from rich.prompt import Confirm, Prompt
from typer.main import Typer
import requests
import tempfile
import shutil
import os
from dotenv import load_dotenv, set_key
from modelith.core.db.generate_database import generate_database
from modelith import ENV_FILE_PATH, DATA_DIR_PATH, CURRENT_PLATFORM

console: Console = Console()



def ascii_art() -> None:
    print('''

███╗   ███╗ ██████╗ ██████╗ ███████╗██╗     ██╗████████╗██╗  ██╗
████╗ ████║██╔═══██╗██╔══██╗██╔════╝██║     ██║╚══██╔══╝██║  ██║
██╔████╔██║██║   ██║██║  ██║█████╗  ██║     ██║   ██║   ███████║
██║╚██╔╝██║██║   ██║██║  ██║██╔══╝  ██║     ██║   ██║   ██╔══██║
██║ ╚═╝ ██║╚██████╔╝██████╔╝███████╗███████╗██║   ██║   ██║  ██║
╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝╚══════╝╚═╝   ╚═╝   ╚═╝  ╚═╝


''')


def check_bun_installed() -> bool:
    """Check if bun is installed"""
    try:
        subprocess.run(["bun", "--version"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def check_exiftool_installed() -> bool:
    """Check if exiftool is installed"""
    try:
        subprocess.run(["exiftool", "-ver"], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def install_bun(platform_type: str) -> None:
    """Install bun based on platform"""
    console.print("Installing bun...")
    try:
        if platform_type == "windows":
            subprocess.run(
                ['powershell', '-c', 'irm bun.sh/install.ps1 | iex'],
                check=True
            )
        else:
            subprocess.run(
                ['curl', '-fsSL', 'https://bun.sh/install | bash'],
                shell=True,
                check=True
            )
        console.print("[green]Bun installed successfully![/green]")
    except subprocess.CalledProcessError:
        console.print("[red]Failed to install bun[/red]")
        raise typer.Exit(1)

def install_exiftool(platform_type: str) -> None:
    """Install exiftool based on platform"""
    if platform_type == "linux":
        console.print("Please install exiftool using your package manager")
        return
    
    temp_dir = Path(tempfile.mkdtemp())
    try:
        if platform_type == "windows":
            url = "https://exiftool.org/exiftool-13.26_64.zip"
            zip_path = temp_dir / "exiftool.zip"
            response = requests.get(url)
            with open(zip_path, 'wb') as f:
                f.write(response.content)
            shutil.unpack_archive(zip_path, temp_dir)
        elif platform_type == "darwin":
            url = "https://exiftool.org/ExifTool-13.26.pkg"
            pkg_path = temp_dir / "exiftool.pkg"
            response = requests.get(url)
            with open(pkg_path, 'wb') as f:
                f.write(response.content)
            subprocess.run(['sudo', 'installer', '-pkg', pkg_path, '-target', '/'], check=True)
    except Exception as e:
        console.print(f"[red]Failed to install exiftool: {e}[/red]")
        raise typer.Exit(1)
    finally:
        shutil.rmtree(temp_dir)


def add_commands(app: Typer) -> None:
    @app.command()
    def init() -> None:
        """Initialize the Modelith Instance on your computer"""
        ascii_art()

        # Get platform and data directory
        platform_type: str = CURRENT_PLATFORM
        
        # Setup database in data directory
        default_db_path = DATA_DIR_PATH / "modelith.db"
        db_path = Path(os.environ.get("DB_PATH", str(default_db_path)))


        # Check if .env.local exists, create if it doesn't
        env_exists = ENV_FILE_PATH.exists()
        if not env_exists:
            console.print("[yellow].env.local file is missing. Creating it.[/yellow]")
            with open(ENV_FILE_PATH, "w") as f:
                f.write("# Modelith environment variables\n")
            env_exists = True

        # Check if DB_PATH is setup properly
        if "DB_PATH" not in os.environ:
            console.print("[yellow].env.local is missing DB_PATH. Setting it to default.[/yellow]")
            set_key(dotenv_path=ENV_FILE_PATH, key_to_set="DB_PATH", value_to_set=str(default_db_path), quote_mode="always")
            load_dotenv(dotenv_path=ENV_FILE_PATH)
        
        # Check if dependencies are installed
        bun_installed = check_bun_installed()
        exiftool_installed = check_exiftool_installed()
        db_exists = db_path.exists()
        
        # Print status of dependencies
        console.print("Checking dependencies...")
        console.print(f"[ {'[green]✓[/green]' if bun_installed else '[red]✗[/red]' } ] Bun")
        console.print(f"[ {'[green]✓[/green]' if exiftool_installed else '[red]✗[/red]' } ] Exiftool")
        console.print(f"[ {'[green]✓[/green]' if db_exists else '[red]✗[/red]' } ] Modelith database")
        console.print(f"[ {'[green]✓[/green]' if env_exists else '[red]✗[/red]' } ] .env.local file")
        
        # Install bun if needed
        if not bun_installed:
            console.print("Bun is not installed.")
            if Confirm.ask("Install it?"):
                console.print("Installing Bun...")
                install_bun(platform_type)
                bun_installed = True  # Update status after installation
        
        # Install exiftool if needed
        if not exiftool_installed:
            console.print("Exiftool is not installed.")
            if Confirm.ask("Install it?"):
                console.print("Installing Exiftool...")
                install_exiftool(platform_type)
                exiftool_installed = True  # Update status after installation
        
        # Initialize database if it doesn't exist
        if not db_exists:
            console.print(f"Using data directory: {DATA_DIR_PATH}")
            console.print(f"Creating database at: {db_path}")
            # Ensure parent directory exists
            db_path.parent.mkdir(parents=True, exist_ok=True)
            generate_database()
            db_exists = True  # Update status after creation
            
            # Install frontend dependencies (only on initial database creation)
            frontend_path = Path(__file__).parent.parent.parent.parent / "frontend"
            if frontend_path.exists():
                console.print("Installing frontend dependencies...")
                try:
                    subprocess.run(["bun", "install"], cwd=frontend_path, check=True)
                    console.print("[green]Frontend dependencies installed successfully![/green]")
                except subprocess.CalledProcessError:
                    console.print("[red]Failed to install frontend dependencies[/red]")
                    raise typer.Exit(1)
            
            console.print("[green]Modelith initialized successfully![/green]")
        
        # If all dependencies are now installed, print success message
        if bun_installed and exiftool_installed and db_exists and env_exists:
            console.print("[green]All dependencies are installed.[/green]")