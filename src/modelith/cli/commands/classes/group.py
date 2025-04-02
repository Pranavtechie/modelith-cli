from typer import Typer
from modelith.cli.commands.classes import create, upload

class_command = Typer(name="class", help="Manage classes, upload students' data")

def add_commands(app: Typer) -> None:
    """Add the class command group to the main app"""
    app.add_typer(class_command, name="class")
    create.add_commands(class_command)
    upload.add_commands(class_command)  