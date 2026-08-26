import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
    LLM_CORPORA_BASE_PATH,
    stageLlmCorporaBuild,
} from "./stage-llm-corpora.mjs";

const DEFAULT_REPOSITORY_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
);

export default function llmCorporaIntegration({
    repositoryRoot = DEFAULT_REPOSITORY_ROOT,
    runGameBuild = runNpmGameBuild,
    stageBuild = stageLlmCorporaBuild,
} = {}) {
    const resolvedRepositoryRoot = path.resolve(repositoryRoot);
    const gameDirectory = path.join(resolvedRepositoryRoot, "games", "LLM_Corpora");
    const gameDist = path.join(gameDirectory, "dist");
    const sourceCname = path.join(resolvedRepositoryRoot, "public", "CNAME");

    return {
        name: "llm-corpora-static-game",
        hooks: {
            "astro:build:done": async ({ dir, logger }) => {
                logger.info("Building the LLM Corpora static game...");
                await runGameBuild({
                    gameDirectory,
                    basePath: LLM_CORPORA_BASE_PATH,
                });
                await stageBuild({
                    siteDist: fileURLToPath(dir),
                    gameDist,
                    sourceCname,
                });
                logger.info("Staged the LLM Corpora game at games/LLM_Corpora/.");
            },
        },
    };
}

export function runNpmGameBuild({ gameDirectory, basePath }) {
    return new Promise((resolve, reject) => {
        if (basePath !== LLM_CORPORA_BASE_PATH) {
            reject(new Error(`Unsupported LLM Corpora deployment base path: ${String(basePath)}`));
            return;
        }

        const child = spawn("npm run build", {
            cwd: gameDirectory,
            env: {
                ...process.env,
                LLM_CORPORA_BASE_PATH: basePath,
            },
            shell: true,
            stdio: "inherit",
            windowsHide: true,
        });

        child.once("error", reject);
        child.once("close", (code, signal) => {
            if (code === 0) {
                resolve();
                return;
            }

            const outcome = signal === null
                ? `exit code ${String(code)}`
                : `signal ${signal}`;
            reject(new Error(`LLM Corpora game build failed with ${outcome}.`));
        });
    });
}
