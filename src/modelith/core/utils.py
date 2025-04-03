
from rich.console import Console
from rich.prompt import Prompt
from modelith.core.db.db_classes import fetch_classes, create_class

console = Console()


def select_class() -> str:
    """Select a class from available classes or create default if none exists."""
    classes = fetch_classes()

    if not classes:
        console.print("[yellow]Warning: No classes found in database. Creating default class...[/yellow]")
        create_class("DefaultClass")
        class_name = "DefaultClass"
        console.print(f"Using class: [bold]{class_name}[/bold]")
    elif len(classes) == 1:
        class_name = classes[0]["class_name"]
        console.print(f"Using class: [bold]{class_name}[/bold]")
    else:
        console.print("[blue]Multiple classes found. Please select one:[/blue]")
        class_options = {str(i+1): c["class_name"] for i, c in enumerate(classes)}
        for key, name in class_options.items():
            console.print(f"  {key}: {name}")
        
        choice = Prompt.ask("Enter class number", choices=list(class_options.keys()))
        class_name = class_options[choice]
        console.print(f"Selected class: [bold]{class_name}[/bold]")
    
    return class_name