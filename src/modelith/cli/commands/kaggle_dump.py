from typer.main import Typer
import typer
from modelith.kaggle_automation.kaggle_login import run as kaggle_run
import os

def add_commands(app: Typer):

    @app.command()
    def kaggle_dump(folder: str | None = typer.Option(None, "--folder", "-f", help="Folder to download notebooks to. Defaults to current directory.")):
        """Get the Jupyter Notebooks shared with you downloaded"""
        if folder is None:
            download_path: str = os.getcwd()  # Use current directory if no folder is specified
        else:
            download_path: str = os.path.abspath(folder)  # Use absolute path of specified folder

        kaggle_run(download_path=download_path)
        