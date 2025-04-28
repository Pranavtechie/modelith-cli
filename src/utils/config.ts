import envPaths from 'env-paths';
import { join } from 'path';

const paths = envPaths('modelith', { suffix: '' });
export const configPath = join(paths.config, 'config.json');
export const dbPath = join(paths.data, 'modelith-db.sqlite');

export async function loadEnv() {
    await verifyConfigFile();
    const config = await Bun.file(configPath).json();
    Object.assign(process.env, config);
}

export async function verifyConfigFile() {
    try {
        const configFile = await Bun.file(configPath).exists()
        const dbFile = await Bun.file(dbPath).exists()
        if (configFile && dbFile) {
            return true;
        } else {
            await createConfigFile();
            return false;
        }
    } catch (error) {
        // If we can't create the config files (e.g., in CI environment)
        // just log a message and return true to avoid blocking the build
        console.warn("Unable to verify or create config files. This is normal in CI environments.");
        return true;
    }
}

export async function createConfigFile() {
    try {
        const config = {
            DB_FILE_NAME: join(paths.data, 'modelith-db.sqlite'),
        };

        await Bun.write(configPath, JSON.stringify(config, null, 2), { createPath: true });
        await Bun.write(dbPath, '', { createPath: true })
        await loadEnv()
    } catch (error) {
        // If we can't create the config files (e.g., in CI environment)
        // just log a message and continue
        console.warn("Unable to create config files. This is normal in CI environments.");
    }
}
