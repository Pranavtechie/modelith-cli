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
    const configFile = await Bun.file(configPath).exists()
    const dbFile = await Bun.file(dbPath).exists()
    if (configFile && dbFile) {
        return true;
    } else {
        await createConfigFile();
        return false;
    }
}

export async function createConfigFile() {
    const config = {
        DB_FILE_NAME: join(paths.data, 'modelith-db.sqlite'),
    };

    await Bun.write(configPath, JSON.stringify(config, null, 2), { createPath: true });
    await Bun.write(dbPath, '', { createPath: true })
    await loadEnv()
}
