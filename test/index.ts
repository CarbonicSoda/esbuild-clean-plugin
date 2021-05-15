import { build, BuildOptions } from 'esbuild';
import tempy from 'tempy';
import path from 'path';
import fs from 'fs';

import { cleanPlugin, PluginOptions } from '../src';

const filesExists = (filePath: string, fileNames: string[]) => {
    return fileNames.every((fileName) => {
        fileName = path.resolve(filePath, fileName);

        return fs.existsSync(fileName);
    });
};

const writeFile = (filePath: string, fileName: string, data = '') => {
    fileName = path.resolve(filePath, fileName);

    fs.writeFileSync(fileName, data);
};

const runBuild = (
    buildOptions: BuildOptions = {},
    pluginOptions?: PluginOptions,
) => {
    return build({
        metafile: true,
        plugins: [cleanPlugin(pluginOptions)],
        ...buildOptions,
    });
};

const fixtures = ['original.js', 'original.css'];

describe('esbuild-clean-plugin', () => {
    let entryDir: string;
    let outDir: string;

    beforeEach(() => {
        jest.resetAllMocks();

        entryDir = tempy.directory();
        outDir = tempy.directory();

        writeFile(entryDir, 'a.js');

        fixtures.forEach((fixture) => {
            writeFile(outDir, fixture);
        });
    });

    test('Delete stale files on each run', async (done) => {
        let initialFileName: string;

        const buildResult = await runBuild({
            entryNames: '[hash]',
            entryPoints: [path.resolve(entryDir, 'a.js')],
            outdir: outDir,
            watch: {
                onRebuild(error, result) {
                    if (result?.stop) {
                        result.stop();
                    }

                    const fileName = path.basename(
                        Object.keys(result?.metafile?.outputs ?? [])[0],
                    );

                    expect(filesExists(outDir, [fileName])).toBe(true);
                    expect(filesExists(outDir, [initialFileName])).toBe(false);

                    done();
                },
            },
        });

        initialFileName = path.basename(
            Object.keys(buildResult.metafile?.outputs ?? [])[0],
        );

        writeFile(entryDir, 'a.js', 'const foo = true;');
    });

    test('Deletes files in initialCleanPatterns', async () => {
        await runBuild({
            entryPoints: [path.resolve(entryDir, 'a.js')],
            outdir: outDir,
        });

        expect(filesExists(outDir, fixtures)).toBe(false);
    });

    test("Doesn't delete anything if initialCleanPatterns is empty", async () => {
        await runBuild(
            {
                entryPoints: [path.resolve(entryDir, 'a.js')],
                outdir: outDir,
            },
            {
                initialCleanPatterns: [],
            },
        );

        expect(filesExists(outDir, fixtures)).toBe(true);
    });

    test("Doesn't delete files in dry mode", async () => {
        await runBuild(
            {
                entryPoints: [path.resolve(entryDir, 'a.js')],
                outdir: outDir,
            },
            {
                dry: true,
            },
        );

        expect(filesExists(outDir, fixtures)).toBe(true);
    });

    test('Print stats in verbose mode', async () => {
        const consoleSpy = jest
            .spyOn(global.console, 'log')
            .mockImplementation();

        await runBuild(
            {
                entryPoints: [path.resolve(entryDir, 'a.js')],
                outdir: outDir,
            },
            {
                verbose: true,
            },
        );

        expect(consoleSpy).toHaveBeenCalled();
    });

    test("Stops if 'metafile' option isn't supplied", async () => {
        const consoleSpy = jest
            .spyOn(global.console, 'warn')
            .mockImplementation();

        await runBuild({
            entryPoints: [path.resolve(entryDir, 'a.js')],
            metafile: undefined,
            outdir: outDir,
        });

        expect(filesExists(outDir, fixtures)).toBe(true);
        expect(consoleSpy).toHaveBeenCalled();
    });

    test("Stops if 'outdir' option isn't supplied", async () => {
        const consoleSpy = jest
            .spyOn(global.console, 'warn')
            .mockImplementation();

        await runBuild({
            entryPoints: [path.resolve(entryDir, 'a.js')],
            outdir: undefined,
        });

        expect(filesExists(outDir, fixtures)).toBe(true);
        expect(consoleSpy).toHaveBeenCalled();
    });
});