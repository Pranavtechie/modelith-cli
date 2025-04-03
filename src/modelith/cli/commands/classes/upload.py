from typer import Typer
from rich.console import Console
from rich.panel import Panel
import typer
from modelith.core.utils import select_class
from modelith.core.db.db_classes import upload_class_data

console = Console()

def add_commands(classes):
    @classes.command()
    def upload_data(
        csv_path: str = typer.Argument(..., help="Path to the CSV file containing student data"),
    ) -> None:
        """Upload your class data (student information) to the database"""
        try:
            # Use the common class selection logic
            class_name = select_class()
            
            # Display selected class in a panel
            console.print(Panel.fit(
                f"Selected class: [bold cyan]{class_name}[/bold cyan]",
                title="Class Selection",
                border_style="green"
            ))
            
            # Upload the data
            upload_class_data(class_name, csv_path)
            console.print(f"[green]Successfully uploaded student data for class: {class_name}[/green]")
        
        except Exception as e:
            console.print(f"[red]Error: {str(e)}[/red]")
            raise typer.Exit(1)