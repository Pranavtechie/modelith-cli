import envPaths from 'env-paths';
import { join } from 'path';
import { existsSync } from 'fs';

const paths = envPaths('modelith', { suffix: '' });
export const configPath = join(paths.config, 'config.json');
export const dbPath = join(paths.data, 'modelith-db.sqlite');

export async function loadEnv() {
    const config = await Bun.file(configPath).json();
    Object.assign(process.env, config);
}

export async function verifyConfigFile() {
    let configFile = Bun.file(configPath)
    let configFileStatus = await configFile.exists();
    if (!configFileStatus) {
        await createConfigFile();
        return false;
    }
    return true;
}

export async function createConfigFile() {
    const config = {
        DB_FILE_NAME: join(paths.data, 'modelith-db.sqlite'),
    };

    await Bun.write(configPath, JSON.stringify(config, null, 2));
    loadEnv()
}