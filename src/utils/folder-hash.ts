import { readdir } from "node:fs/promises";

export async function generateFolderHash(directory: string): Promise<string | null> {

    let notebookFiles: string[] = [];

    try {

        notebookFiles = (await readdir(directory, { recursive: true }))
            .filter(f => f.endsWith('.ipynb'))
            .sort()

        if (!notebookFiles.length) return null;

    } catch (e) {
        console.error(`Error reading directory ${directory}: ${e}`);
        return null;
    }

    const hasher = new Bun.CryptoHasher("sha256");

    for (const filename of notebookFiles) {
        const filepath = `${directory}/${filename}`;
        try {
            const file = Bun.file(filepath);
            const stats = file.lastModified; // milliseconds since epoch
            const timestamp = new Date(stats).toISOString().replace('T', ' ').slice(0, 19);
            hasher.update(`${filename}-${timestamp}`)
        } catch (e) {
            console.error(`Error processing ${filename}: ${e}`);
            continue;
        }
    }

    return hasher.digest('hex');
}