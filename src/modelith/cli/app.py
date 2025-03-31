import typer
from rich.console import Console
from modelith.cli.commands import init, kaggle_dump, extract

app = typer.Typer(name="modolith", add_completion=False)
console = Console()

# Register commands explicitly
extract.add_commands(app)
init.add_commands(app)
kaggle_dump.add_commands(app)


def run():
    app()

if __name__ == "__main__":
    run()