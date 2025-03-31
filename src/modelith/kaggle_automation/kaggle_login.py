from playwright.sync_api._generated import BrowserContext, Page
from typing import Any, LiteralString
import time
from playwright.sync_api import BrowserContext, sync_playwright
from urllib.parse import urlparse
import os
import json
from rich.progress import Progress, BarColumn, TaskID, SpinnerColumn, MofNCompleteColumn, TimeElapsedColumn
from rich.console import Console

console = Console()
response_data = []
notebook_data: list[Any] = []

download_path: None | LiteralString = None
user_data_dir = "./kaggle_browser_data"

def extract_notebook_data() -> list[Any]:
    for item in response_data:
        if 'kernels' in item:
            for kernel in item['kernels']:
                notebook_data.append(
                    {"script_url" : kernel["scriptUrl"],
                    "kernel_id": kernel["scriptVersionId"],
                    "title": kernel["title"],
                    "status": False})

def filter_response(response):
    if response.url == "https://www.kaggle.com/api/i/kernels.KernelsService/ListKernels": 
        response_data.append(response.json())


def scroll_nested_element(selector) -> None:
    last_height = 0
    while True:
        # Scroll the specific element to its bottom
        page.evaluate(f"""
            const element = document.querySelector('{selector}');
            element.scrollTo(0, element.scrollHeight);
        """)
        page.wait_for_timeout(1500)  # Wait for content to load
        
        # Get current scroll height of the element
        new_height = page.evaluate(f"""
            (selector) => {{
                const element = document.querySelector(selector);
                return element.scrollHeight;
            }}
        """, selector)
        
        # Stop if height doesn't change
        if new_height == last_height:
            break
        last_height = new_height

def start_playwright_instance() -> tuple[BrowserContext, Page]:

    p = sync_playwright().start()
    if not os.path.exists(user_data_dir):
        print("No existing context found, creating new one...")
        context = p.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=False,
            no_viewport=True,
            accept_downloads=True
        )
        page = context.new_page()
        page.goto("https://www.kaggle.com/account/login")
        input("Press 'Enter' after logging in to validate account...")
        page.goto("https://www.kaggle.com/me")
        print(f"Using Kaggle account: `{urlparse(page.url).path}`")
    else:
        print("Using existing context...")
        context = p.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=False,
            no_viewport=True
        )
        page = context.new_page()
        page.goto("https://www.kaggle.com/me")
        print(f"Using Kaggle account: `{urlparse(page.url).path}`")

    return context, page


def navigate_and_fetch_notebooks(context, page):
    input("Navigate to the competition page, then press Enter...")

    print("\n\n")
    with Progress(SpinnerColumn(), "{task.description}", transient=True) as progress:
        page.on("response", lambda response: filter_response(response))

        page.locator('a[aria-label^="Code,"]').click()
        page.wait_for_timeout(1500)
        page.locator('button[aria-label^="Shared With You,"]').click()
        page.wait_for_timeout(1500)

        progress.add_task(description="[green]Fetching Notebooks...")
        e = page.locator('div#site-content')
        e.focus()

        scroll_nested_element(selector='div#site-content')
        page.wait_for_timeout(1500)

        extract_notebook_data()
    


def run(download_path):
    download_path = download_path
    status_file_path = os.path.join(download_path, 'competition_data.json')
    context = None
    page = None
    if os.path.exists(path=status_file_path):
        with open(status_file_path, "r") as infile:
            notebook_data = json.load(infile)
        context, page = start_playwright_instance()
        
    else:
        print("Status file not found, fetching notebooks...")
        context, page = start_playwright_instance()
        navigate_and_fetch_notebooks(context, page)


    print(f"Fetched {len(notebook_data)} Notebooks")
    print(f"Starting Download...\n")
        
    failed_notebook_download = []
    continuously_failed_count = 0

        
    with Progress(
        SpinnerColumn(),
        "{task.description}",
        MofNCompleteColumn(),
        BarColumn(),
        "[progress.percentage]{task.percentage:>3.1f}%",
        TimeElapsedColumn(),
        console=console,
        transient=True
    ) as progress:
        download_task: TaskID = progress.add_task(description="[green]Downloading notebooks", total=len(notebook_data))

        pending_notebooks_urls = list(filter(lambda x: x['status'] != True, notebook_data))
        completed_notebook_urls = list(filter(lambda x: x['status'] == True, notebook_data))

        progress.update(task_id=download_task, advance=len(completed_notebook_urls))
        successful_notebook_download_count = 0

        for i in range(len(pending_notebooks_urls)):
            notebook = pending_notebooks_urls[i]
            kernel_id = notebook['kernel_id']
            progress.console.print(f"Downloading - {notebook['script_url']}")
            try:
                # Use page.wait_for_download() to properly handle the download
                with page.expect_download() as download_info:
                    page.evaluate("""(url) => {
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = "";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }""", f"https://www.kaggle.com/kernels/scriptcontent/{kernel_id}/download")
                
                    download = download_info.value
                    download.save_as(os.path.join(download_path, download.suggested_filename))
                    progress.console.print(f"File - [dark_orange]{notebook['title']}[/dark_orange] saved\n")

                for dict in notebook_data:
                    if dict["kernel_id"] == notebook["kernel_id"]:
                        dict["status"] = True

                with open(file=status_file_path, mode="w") as outfile:
                    json.dump(notebook_data, outfile)

                successful_notebook_download_count += 1
                continuously_failed_count = 0


            except Exception as e:
                print(e.args)
                print(e.__cause__)
                print(e.__class__)
                progress.console.print(f"🚨 File - [dark_orange]{notebook['title']}[/dark_orange] failed to save\n")
                failed_notebook_download.append(notebook)
                continuously_failed_count += 1

                if continuously_failed_count == 3:
                    print("🚨🚨🚨 - Three Notebooks Failed Contiguously - Aborting!! 🚨🚨🚨")
                    break

            time.sleep(5)
            progress.update(task_id=download_task, advance=1)


        if len(failed_notebook_download) == 0:
            print(f"All {len(pending_notebooks_urls)} Notebooks are downloaded\n\n")
            os.remove(path=status_file_path)
        else:
            print(f"{successful_notebook_download_count}/{len(pending_notebooks_urls)} notebooks downloaded\n")
            print("FAILED NOTEBOOKS DATA")
            print(json.dumps(obj=failed_notebook_download, indent=2))


    input("Press 'Enter' to terminate the browser...")

    context.close()