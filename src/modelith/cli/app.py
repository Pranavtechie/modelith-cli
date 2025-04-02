from typer.main import Typer
import typer
from rich.console import Console
from modelith.cli.commands import init, kaggle_dump, extract, classes, evaluate
from dotenv import load_dotenv
from modelith import ENV_FILE_PATH

app: Typer = typer.Typer(name="modelith", context_settings={"help_option_names": ["-h", "--help"]})
console: Console = Console()

load_dotenv(dotenv_path=ENV_FILE_PATH)


# Registering Typer Commands
extract.add_commands(app)
init.add_commands(app)
kaggle_dump.add_commands(app)
evaluate.add_commands(app)
classes.add_commands(app)

def run() -> None:
    app()

if __name__ == "__main__":
    run()