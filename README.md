# Modelith

Modelith is an open-source, CLI-based tool to quickly compare and make it easier to evaluate any kind of coding assignment. Built for Professors, TAs, Teachers.

## Features

- Quickly draw a comparison of all the submissions in a folder with the help of ASTs. Currently only supports `.ipynb` files
- Web interface to compare and filter submissions using thresholds
- Identify plagiarized/copied submissions through similarity matrix
- Simple storage solution (in SQLite) for all submissions
- Class management to evaluate and maintain records of multiple classes
- 🚧 Trend assessment for multiple assignments throughout the course/class
- 🚧 Support for multiple languages (C, C++, Java, R, etc.)

## Installation

Modelith requires [Bun](https://bun.sh/) as its JavaScript runtime. First install Bun:

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
```

Then you can install Modelith using bun:

```bash
bun install -g modelith
```

To make use of `kaggle-dump` feature you have to install `playwright`. Use the command below

```bash
bunx -g playwright install --with-deps chromium
```

## Getting Started

After installing Modelith, initialize it:

```bash
modelith init
```

This command sets up your configuration, initializes the local database, and ensures that necessary components like Playwright's browser (for features such as Kaggle notebook dumping) are ready. If Playwright (an optional feature) is installed, `init` will attempt to download the required browser version if it's missing.

## Simple Tutorial

**STEP 0: Initialize Modelith**

```bash
modelith init  # This will ensure all key components of modelith are installed and present. You don't need to run this everytime
```

**STEP 1: Creating a new cohort**

```bash
modelith cohort create <cohort-name>
```

**STEP 2: Adding student's data to the cohort**

Modelith current accepts `.csv` files only. The `.csv` file should contain two columns named `regno` and `name` (in lowercase). It can contain more columns, however only these two columns will be used.

```bash
modelith cohort upload-data <file-name>
```

**STEP 3: "Extracting" data from `.ipynb` files**

Please ensure beforehand that you have all the `.ipynb` notebooks for the assignment are present in a single folder.

```bash
modelith extract -i <folder-name>
```

**STEP 4: Interactive Viewer in browser**

```bash
modelith start
```

Running this command will give you a link which when opened in a browser will give you the ability to view the similarity matrix and compare two different notebooks, we'll give comparision tables for metadata and side-by-side notebook cells for viewing.

### Downloading Competition Notebooks from Kaggle.

If you are using kaggle competitions for your assingments. Kaggle doesn't provide export functionality for all the notebooks. You can use `kaggle-dump` utility to perform this task.

First, ensure to create a new folder on your computer. We'll use this path, and store all downloaded `.ipynb` notebooks here.

```bash
modelith kaggle-dump -f <folder-name>
```
