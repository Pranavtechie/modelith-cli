import { type BrowserContext, type Page, chromium } from "playwright";
import chalk from "chalk";
import ora from "ora";
import { type Ora } from "ora";

interface NotebookData {
    script_url: string;
    kernel_id: string;
    title: string;
    status: boolean;
}

const user_data_dir = "./kaggle_browser_data";
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
        console.log("FOUND!!")
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

    console.log(`Using Kaggle account: ${chalk.green(new URL(page.url()).pathname)}`);


    return [context, page];
}

async function navigateAndFetchNotebooks(context: BrowserContext, page: Page): Promise<NotebookData[]> {
    await prompt(chalk.yellow("Navigate to competition page, then press Enter..."));
    console.log("\n");
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

async function downloadNotebook(page: Page, notebook: NotebookData, download_path: string, spinner: Ora): Promise<boolean> {
    try {
        const downloadPromise = page.waitForEvent("download")

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

        await download.saveAs(`${download_path}/${download.suggestedFilename()}`);
        spinner.text = chalk.magenta(`File - ${notebook.title} saved`)
        return true;
    } catch (e) {
        console.log(chalk.red(`🚨 File - ${notebook.title} failed to save\n`));
        console.error(e);
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
        console.log("Status file not found, fetching notebooks...");
        [context, page] = await startPlaywrightInstance();
        notebookData = await navigateAndFetchNotebooks(context, page);
    }

    console.log(chalk.bold(`Fetched ${notebookData.length} Notebooks`));
    console.log(chalk.bold("Starting Download...\n"));

    const pendingNotebooks = notebookData.filter((n) => !n.status);
    const completedNotebooks = notebookData.filter((n) => n.status);
    const failedDownloads: NotebookData[] = [];
    let continuousFailCount = 0;
    let successCount = 0;

    if (pendingNotebooks.length > 0) {
        const spinner = ora({
            text: chalk.green("Downloading notebooks"),
            prefixText: `${completedNotebooks.length}/${notebookData.length}`,
        }).start();


        for (const notebook of pendingNotebooks) {
            console.log(chalk.blue(`Downloading - ${notebook.script_url}`));

            const success = await downloadNotebook(page, notebook, download_path, spinner);

            if (success) {
                notebook.status = true;
                successCount++;
                continuousFailCount = 0;
                await Bun.write(statusFilePath, JSON.stringify(notebookData));
            } else {
                failedDownloads.push(notebook);
                continuousFailCount++;
                if (continuousFailCount === 3) {
                    console.log(chalk.red("🚨 Three Notebooks Failed Contiguously - Aborting!! 🚨"));
                    break;
                }
            }

            spinner.prefixText = `${completedNotebooks.length + successCount}/${notebookData.length}`;
            await Bun.sleep(2000);
        }

        spinner.stop();

        if (failedDownloads.length === 0) {
            console.log(chalk.green(`All ${pendingNotebooks.length} Notebooks downloaded\n`));
        } else {
            console.log(chalk.yellow(`${successCount}/${pendingNotebooks.length} notebooks downloaded\n`));
            console.log(chalk.red("FAILED NOTEBOOKS DATA"));
            console.log(JSON.stringify(failedDownloads, null, 2));
        }
    } else {
        console.log(chalk.green("All notebooks already downloaded! Nothing to download!!"));
    }

    await prompt(chalk.yellow("Press 'Enter' to terminate the browser..."));

    context.removeAllListeners();
    await context.close();
}


