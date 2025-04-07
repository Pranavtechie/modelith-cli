# Modelith

Modelith is a open-source, CLI-based tool to quickly compare and make it easier to evaluate any kind of coding assignment. Built for Professors, TAs, Teachers.

## Features

- Quickly draw a comparison of all the submissions in a folder with the help of ASTs. Currently only supports `.ipynb` files
- 🚧 Easily compare and filter submissions using thresholds (in the Web Client)
- Identify plagiarized / copied submissions, through similarity Matrix
- Simple storage solution (in sqlite db) for all submissions
- 🚧 Trend assessment for multiple assignments throughout the course / class.
- Class Management, so you can have evaluate and maintain record of multiple classes
- 🚧 Support for Multiple Languages (C, C++, Java, R, etc..)

## Getting Started

Modelith relies on heavily on [Bun](https://bun.sh/) for package management and running the CLI. You can install Bun by following their [installation guide](https://bun.sh/docs/installation).

```shell
bunx --bun create modelith
```

## Usage (🚧 - will be updated)

The CLI tool is very minimalistic by design and has very few commands. You can view all the commands by running `modelith -h`

You can view the docs at [docs.modelith.com](https://docs.modelith.com) for more information on how to use the tool. The docs are yet to be updated
