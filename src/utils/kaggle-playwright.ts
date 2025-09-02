import { paths } from "@utils/config";
import chalk from "chalk";
import ora, { type Ora } from "ora";
import path from "path";
import { type BrowserContext, type Page, chromium } from "playwright";
interface NotebookData {
    script_url: string;
    kernel_id: string;
    title: string;
    status: boolean;
}

const user_data_dir = path.join(paths.data, "kaggle_browser_data");
let response_data: any[] = [];

async function extractNotebookData(): Promise<NotebookData[]> {
    const notebookData: NotebookData[] = [];
    for (const item of response_data) {
        if ("kernels" in item) {
            for (const kernel of item.kernels) {
                notebookData.push({
                    script_url: kernel.scriptUrl,
                    kernel_id: kernel.scriptVersionId,
                    title: kernel.title,
                    status: false,
                });
            }
        }
    }
    return notebookData;
}

async function filterResponse(response: any) {
    if (response.url() === "https://www.kaggle.com/api/i/kernels.KernelsService/ListKernels") {
        response_data.push(await response.json());
    }
}

async function scrollNestedElement(page: Page, selector: string): Promise<void> {
    let lastHeight = 0;
    while (true) {
        await page.evaluate(
            (sel) => {
                const element = document.querySelector(sel) as HTMLElement;
                element.scrollTo(0, element.scrollHeight);
            },
            selector
        );
        await Bun.sleep(1500);

        const newHeight = await page.evaluate(
            (sel) => (document.querySelector(sel) as HTMLElement).scrollHeight,
            selector
        );

        if (newHeight === lastHeight) break;
        lastHeight = newHeight;
    }
}

async function prompt(message: string): Promise<void> {
    process.stdout.write(message);
    await new Promise((resolve) => process.stdin.once("data", resolve));
}

async function startPlaywrightInstance(): Promise<[BrowserContext, Page]> {


    let context: BrowserContext;
    let page: Page;

    context = await chromium.launchPersistentContext(user_data_dir, {
        acceptDownloads: true,
        viewport: null,
        headless: false,
    });
    page = await context.newPage();
    await page.goto("https://www.kaggle.com/me");
    await page.waitForURL((url) => {
        const path = url.pathname;
        if (path === '/account/login') {
            return true;
        }
        if (path.startsWith('/')) {
            return true;
        }
        return false; // Keeps waiting if neither matches
    });

    const finalUrl = page.url();
    if (finalUrl.includes('/account/login')) {
        await prompt(chalk.yellow("Press 'Enter' after logging in..."));
    }

    return [context, page];
}

async function navigateAndFetchNotebooks(context: BrowserContext, page: Page): Promise<NotebookData[]> {
    await prompt(chalk.yellow("Navigate to competition page, then press Enter..."));
    page.on("response", (response) => filterResponse(response));

    const spinner = ora(chalk.green("Fetching Notebooks...")).start();

    // Add response listener

    await page.locator('a[aria-label^="Code,"]').click();
    await Bun.sleep(1500);
    await page.locator('button[aria-label^="Shared With You,"]').click();
    await Bun.sleep(1500);

    await page.locator("div#site-content").focus();
    await scrollNestedElement(page, "div#site-content");
    await Bun.sleep(1500);

    spinner.succeed();
    return extractNotebookData();
}

async function validateDownloadedFile(filePath: string): Promise<boolean> {
    try {
        const stats = await Bun.file(filePath).stat();
        const fileName = path.basename(filePath);

        // Check if file has correct extension (.ipynb) and non-zero size
        if (!fileName.endsWith('.ipynb') || stats.size === 0) {
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

async function downloadNotebook(page: Page, notebook: NotebookData, download_path: string, spinner: Ora): Promise<boolean> {
    try {
        const downloadPromise = page.waitForEvent("download");

        await page.evaluate(
            (url) => {
                const link = document.createElement("a");
                link.href = url;
                link.download = "";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            },
            `https://www.kaggle.com/kernels/scriptcontent/${notebook.kernel_id}/download`
        );

        const download = await downloadPromise;
        const suggestedFilename = download.suggestedFilename();
        const filePath = `${download_path}/${suggestedFilename}`;

        await download.saveAs(filePath);

        // Validate the downloaded file
        const isValid = await validateDownloadedFile(filePath);

        if (isValid) {
            return true;
        } else {
            // Clean up invalid file
            try {
                await Bun.file(filePath).delete();
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
            return false;
        }
    } catch (e) {
        return false;
    }
}

export async function run(download_path: string): Promise<void> {
    const statusFilePath = `${download_path}/competition_data.json`;
    let notebookData: NotebookData[] = [];
    let context: BrowserContext;
    let page: Page;

    const statusFileExists = await Bun.file(statusFilePath).exists();
    if (statusFileExists) {
        notebookData = JSON.parse(await Bun.file(statusFilePath).text());
        [context, page] = await startPlaywrightInstance();
    } else {
        [context, page] = await startPlaywrightInstance();
        notebookData = await navigateAndFetchNotebooks(context, page);
    }

    const pendingNotebooks = notebookData.filter((n) => !n.status);
    const completedNotebooks = notebookData.filter((n) => n.status);
    let successCount = 0;

    if (pendingNotebooks.length > 0) {
        const spinner = ora({
            text: chalk.green("Downloading notebooks"),
            prefixText: `${completedNotebooks.length}/${notebookData.length}`,
        }).start();

        // First pass: download all notebooks
        const failedDownloads: NotebookData[] = [];
        for (const notebook of pendingNotebooks) {
            spinner.text = chalk.blue(`Downloading: ${notebook.title}`);

            const success = await downloadNotebook(page, notebook, download_path, spinner);

            if (success) {
                notebook.status = true;
                successCount++;
                spinner.text = chalk.green(`✓ ${notebook.title} downloaded`);
                await Bun.write(statusFilePath, JSON.stringify(notebookData));
            } else {
                failedDownloads.push(notebook);
                spinner.text = chalk.yellow(`✗ ${notebook.title} failed`);
            }

            spinner.prefixText = `${completedNotebooks.length + successCount}/${notebookData.length}`;
            await Bun.sleep(2000);
        }

        // Second pass: retry failed downloads (up to 5 times each)
        if (failedDownloads.length > 0) {
            spinner.text = chalk.yellow(`Retrying ${failedDownloads.length} failed downloads...`);
            await Bun.sleep(1000);

            let retrySuccessCount = 0;
            const stillFailed: NotebookData[] = [];

            for (let retryAttempt = 1; retryAttempt <= 5; retryAttempt++) {
                if (failedDownloads.length === 0) break;

                spinner.text = chalk.yellow(`Retry attempt ${retryAttempt}/5 (${failedDownloads.length} remaining)`);
                const currentFailed = [...failedDownloads];
                failedDownloads.length = 0; // Clear array

                for (const notebook of currentFailed) {
                    spinner.text = chalk.blue(`Retrying: ${notebook.title} (attempt ${retryAttempt}/5)`);

                    const success = await downloadNotebook(page, notebook, download_path, spinner);

                    if (success) {
                        notebook.status = true;
                        successCount++;
                        retrySuccessCount++;
                        spinner.text = chalk.green(`✓ ${notebook.title} downloaded on retry ${retryAttempt}`);
                        await Bun.write(statusFilePath, JSON.stringify(notebookData));
                        spinner.prefixText = `${completedNotebooks.length + successCount}/${notebookData.length}`;
                    } else {
                        stillFailed.push(notebook);
                        spinner.text = chalk.red(`✗ ${notebook.title} still failed (attempt ${retryAttempt}/5)`);
                    }

                    await Bun.sleep(2000);
                }

                failedDownloads.push(...stillFailed);
            }

            spinner.stop();

            if (failedDownloads.length === 0) {
                console.log(chalk.green(`\nAll ${pendingNotebooks.length} notebooks downloaded successfully!`));
                if (retrySuccessCount > 0) {
                    console.log(chalk.blue(`${retrySuccessCount} notebooks were recovered on retry`));
                }
            } else {
                console.log(chalk.yellow(`\nDownloaded ${successCount}/${pendingNotebooks.length} notebooks`));
                console.log(chalk.red("FAILED NOTEBOOKS:"));
                failedDownloads.forEach((notebook, index) => {
                    console.log(chalk.red(`${index + 1}. ${notebook.title} (ID: ${notebook.kernel_id})`));
                });
                console.log(chalk.red(`\nTotal failed: ${failedDownloads.length}`));
            }
        } else {
            spinner.succeed(chalk.green("All notebooks downloaded successfully!"));
        }
    } else {
        console.log(chalk.green("All notebooks already downloaded! Nothing to download!!"));
    }

    context.removeAllListeners();
    await context.close();
}


