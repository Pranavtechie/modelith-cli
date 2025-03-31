import os
import typer
from rich.console import Console
from modelith.core.generate_database import generate_database

def sanity_check():
    # check if modelith.db file exists. If it doesn't ask the user that we'll create one. with y/cancel options using typer cli
    console = Console()
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "modelith.db")
    
    if not os.path.exists(db_path):
        console.print("[yellow]modelith.db file not found.[/yellow]")
        create_db = typer.confirm("Would you like to create a new modelith.db file?", default=True)
        
        if create_db:
            try:
                generate_database(db_path)
                console.print("[green]modelith.db file created successfully.[/green]\n\n")
                return True
            except Exception as e:
                console.print(f"[red]Error creating modelith.db: {str(e)}[/red]")
                raise typer.Exit(1)
        else:
            console.print("[red]Operation cancelled. modelith.db is required for evaluation.[/red]")
            raise typer.Exit(1)
    
    return True

