from operator import index
from typing import Any
import time
from playwright.sync_api import sync_playwright
from urllib.parse import urlparse
import os
import json

response_data = []

def get_script_urls():
    notebook_data = []
    for item in response_data:
        if 'kernels' in item:
            for kernel in item['kernels']:
                notebook_data.append(
                    {"script_url" : kernel["scriptUrl"],
                    "kernel_id": kernel["scriptVersionId"],
                    "title": kernel["title"]})
    return notebook_data

def filter_response(response):
    if response.url == "https://www.kaggle.com/api/i/kernels.KernelsService/ListKernels": 
        print("FOUND")
        response_data.append(response.json())


def scroll_nested_element(page, selector) -> None:
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


# def download_nb(download, download_path):
#     print(f"Download triggered - ")
#     # Create a unique filename using the suggested name
#     suggested_filename = download.suggested_filename
#     file_path = os.path.join(download_path, suggested_filename)
#     print(f"Saving to: {file_path}")
#     try:
#         download.save_as(file_path)
#         print(f"Download completed ✅: {suggested_filename}")
#     except Exception as e:
#         print(f"Download failed: 🚨{e}")


def run(download_path):
    user_data_dir = "./kaggle_browser_data"
    with sync_playwright() as p:
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

        input("Navigate to the competition page, then press Enter...")

        page.on("response", lambda response: filter_response(response))
        # page.on("download", lambda download: download_nb(download=download, download_path=download_path) )


        page.locator('a[aria-label^="Code,"]').click()
        page.wait_for_timeout(1500)
        page.locator('button[aria-label^="Shared With You,"]').click()
        page.wait_for_timeout(1500)

        e = page.locator('div#site-content')
        e.focus()

        scroll_nested_element(page, selector='div#site-content')
        page.wait_for_timeout(1500)

        notebook_urls = get_script_urls()

        print(json.dumps(obj=notebook_urls, indent=2))

        for notebook in notebook_urls:
            kernel_id = notebook['kernel_id']
            print(f"downloading.... {notebook['script_url']}\n")
            
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
                print("file saved - ✅")

            time.sleep(2)

        input("Should I kill the browser? Press Enter to close...")

        context.close()



if __name__ == "__main__":
    run(download_path=os.getcwd())