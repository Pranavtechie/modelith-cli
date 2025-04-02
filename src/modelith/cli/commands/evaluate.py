import os
import subprocess
import webbrowser
from pathlib import Path
from typer.main import Typer
from rich.console import Console

console = Console()

def add_commands(app: Typer): 

    @app.command()
    def evaluate():
        """Start the evaluation web interface"""
        # Get the frontend directory path relative to this file
        frontend_path = Path(__file__).parent.parent.parent.parent.parent / "frontend"
        
        if not frontend_path.exists():
            console.print("[red]Error: Frontend directory not found[/red]")
            return

        # Change to frontend directory
        os.chdir(frontend_path)
        
        # URL for the dev server
        dev_url = "http://localhost:3000"
        
        try:
            # Start bun dev server
            console.print("[green]Starting development server...[/green]")
            
            # Create and start the process
            process = subprocess.Popen(
                ["bun", "run", "start"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                universal_newlines=True
            )
            
            # Wait a bit for server to start
            import time
            time.sleep(2)
            
            # Open browser
            console.print(f"[green]Opening {dev_url} in your browser...[/green]")
            webbrowser.open(dev_url)
            
            # Stream the output
            while True:
                output = process.stdout.readline()
                if output:
                    print(output.strip())
                if process.poll() is not None:
                    break
                    
        except KeyboardInterrupt:
            console.print("\n[yellow]Shutting down development server...[/yellow]")
            process.terminate()
            process.wait()
            
        except Exception as e:
            console.print(f"[red]Error: {str(e)}[/red]")
            raise

