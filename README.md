# Modelith

Modelith is a open-source, CLI-based tool to quickly compare and make it easier to evaluate any kind of coding assignment. Built for Professors, TAs, Teachers.

## Features

-   Quickly draw a comparison of all the submissions in a folder with the help of ASTs. Currently only supports `.ipynb` files
-   🚧 Easily compare and filter submissions using thresholds (in the Web Client)
-   Identify plagiarized / copied submissions, through similarity Matrix
-   Simple storage solution (in sqlite db) for all submissions
-   🚧 Trend assessment for multiple assignments throughout the course / class.
-   🚧 Class Management, so you can have evaluate and maintain record of multiple classes
-   🚧 Support for Multiple Languages (C, C++, Java, R, etc..)

## Getting Started

Modelith relies on `uv`. If you haven't installed uv yet, please do by following ![Installing uv and Python section](#installing-uv-and-python).

```shell
uv tool install modelith
```

## Installing uv and Python

This project is set up to use [**uv**](https://docs.astral.sh/uv/), the new package
manager for Python. `uv` replaces traditional use of `pyenv`, `pipx`, `poetry`, `pip`,
etc. This is a quick cheat sheet on that:

On macOS or Linux, if you don't have `uv` installed, a quick way to install it:

```shell
curl -LsSf https://astral.sh/uv/install.sh | sh
```

For macOS, you prefer [brew](https://brew.sh/) you can install or upgrade uv with:

```shell
brew update
brew install uv
```

See [uv's docs](https://docs.astral.sh/uv/getting-started/installation/) for more
installation methods and platforms.

Now you can use uv to install a current Python environment:

```shell
uv python install 3.13 # Or pick another version.
```

## Usage (🚧 - will be updated)

The CLI tool is very minimalistic by design and has very few commands. You can view all the commands by running `modelith -h`
