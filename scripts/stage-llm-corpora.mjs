import { randomUUID } from "node:crypto";
import {
    cp,
    lstat,
    mkdir,
    open,
    opendir,
    readFile,
    rename,
    rm,
} from "node:fs/promises";
import path from "node:path";

const GIT_LFS_POINTER_HEADER = "version https://git-lfs.github.com/spec/v1";
const GAME_ROUTE_SEGMENTS = ["games", "LLM_Corpora"];
export const LLM_CORPORA_BASE_PATH = `/${GAME_ROUTE_SEGMENTS.join("/")}/`;

export async function stageLlmCorporaBuild({
    siteDist,
    gameDist,
    sourceCname,
}) {
    const resolvedSiteDist = path.resolve(siteDist);
    const resolvedGameDist = path.resolve(gameDist);
    const resolvedSourceCname = path.resolve(sourceCname);
    const gamesDirectory = path.join(resolvedSiteDist, "games");
    const destination = path.join(resolvedSiteDist, ...GAME_ROUTE_SEGMENTS);
    const stagingDirectory = path.join(
        gamesDirectory,
        `.LLM_Corpora-stage-${process.pid}-${randomUUID()}`,
    );

    assertDescendant(resolvedSiteDist, destination);
    await assertDirectory(resolvedSiteDist, "Astro build directory");
    await assertNonEmptyFile(path.join(resolvedSiteDist, "index.html"), "Astro build index");
    await assertMatchingCname(resolvedSiteDist, resolvedSourceCname);
    await assertValidGameBuild(resolvedGameDist);

    await mkdir(gamesDirectory, { recursive: true });
    try {
        await cp(resolvedGameDist, stagingDirectory, {
            recursive: true,
            errorOnExist: true,
            force: false,
        });
        await assertValidGameBuild(stagingDirectory);

        await rm(destination, { recursive: true, force: true });
        await rename(stagingDirectory, destination);
        await assertMatchingCname(resolvedSiteDist, resolvedSourceCname);
    } finally {
        await rm(stagingDirectory, { recursive: true, force: true });
    }

    return { destination };
}

async function assertValidGameBuild(directory) {
    await assertDirectory(directory, "Game build directory");
    const indexPath = path.join(directory, "index.html");
    await assertNonEmptyFile(
        indexPath,
        "Game build is incomplete because index.html",
    );
    await assertDeploymentBasePath(indexPath);

    const pointerFile = await findGitLfsPointer(directory);
    if (pointerFile !== undefined) {
        throw new Error(`Game build contains a Git LFS pointer instead of hydrated content: ${pointerFile}`);
    }
}

async function assertDeploymentBasePath(indexPath) {
    const indexHtml = await readFile(indexPath, "utf8");
    const requiredAssetPrefix = `${LLM_CORPORA_BASE_PATH}assets/`;
    if (!indexHtml.includes(requiredAssetPrefix)) {
        throw new Error(
            `Game build index.html must use deployment base path '${LLM_CORPORA_BASE_PATH}'.`,
        );
    }
}

async function assertMatchingCname(siteDist, sourceCname) {
    const sourceDomain = await readCname(sourceCname, "Source CNAME");
    const builtCname = path.join(siteDist, "CNAME");
    const builtDomain = await readCname(builtCname, "Astro build CNAME");

    if (builtDomain !== sourceDomain) {
        throw new Error(
            `Astro build CNAME '${builtDomain}' does not match source CNAME '${sourceDomain}'.`,
        );
    }
}

async function readCname(cnamePath, label) {
    let domain;
    try {
        domain = (await readFile(cnamePath, "utf8")).trim();
    } catch (error) {
        throw new Error(`${label} is missing: ${cnamePath}`, { cause: error });
    }

    if (domain.length === 0 || /\s/.test(domain)) {
        throw new Error(`${label} must contain exactly one non-empty domain name: ${cnamePath}`);
    }

    return domain;
}

async function assertDirectory(directory, label) {
    let stats;
    try {
        stats = await lstat(directory);
    } catch (error) {
        throw new Error(`${label} does not exist: ${directory}`, { cause: error });
    }

    if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throw new Error(`${label} must be a real directory: ${directory}`);
    }
}

async function assertNonEmptyFile(file, label) {
    let stats;
    try {
        stats = await lstat(file);
    } catch (error) {
        throw new Error(`${label} is missing: ${file}`, { cause: error });
    }

    if (!stats.isFile() || stats.size === 0) {
        throw new Error(`${label} must be a non-empty regular file: ${file}`);
    }
}

async function findGitLfsPointer(root) {
    const pendingDirectories = [root];
    const pointerHeader = Buffer.from(GIT_LFS_POINTER_HEADER, "utf8");

    while (pendingDirectories.length > 0) {
        const directory = pendingDirectories.pop();
        const entries = await opendir(directory);

        for await (const entry of entries) {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                pendingDirectories.push(entryPath);
                continue;
            }
            if (!entry.isFile()) continue;

            const handle = await open(entryPath, "r");
            try {
                const header = Buffer.alloc(pointerHeader.length);
                const { bytesRead } = await handle.read(header, 0, header.length, 0);
                if (bytesRead === pointerHeader.length && header.equals(pointerHeader)) return entryPath;
            } finally {
                await handle.close();
            }
        }
    }

    return undefined;
}

function assertDescendant(parent, child) {
    const relative = path.relative(parent, child);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Refusing to stage outside the Astro build directory: ${child}`);
    }
}
