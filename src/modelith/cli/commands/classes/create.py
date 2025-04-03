from typer import Typer
from modelith.core.db.db_classes import create_class
from rich.console import Console

console = Console()

def add_commands(classes):
    @classes.command()
    def create(
        name: str
    ) -> None:
        """Create a new class"""
        try:
            create_class(name)
            console.print(f"[green]Successfully created class: {name}[/green]")
        except Exception as e:
            console.print(f"[red]Failed to create class: {e}[/red]")