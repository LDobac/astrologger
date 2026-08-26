import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import llmCorporaIntegration from "./llm-corpora-integration.mjs";
import { stageLlmCorporaBuild } from "./stage-llm-corpora.mjs";

const CNAME_CONTENT = "fixture.example";
const EXPECTED_GAME_BASE_PATH = "/games/LLM_Corpora/";

test("builds the game before staging it into Astro's completed output", async (context) => {
    const fixture = await createIntegrationFixture(context);
    const events = [];
    const logs = [];
    const integration = llmCorporaIntegration({
        repositoryRoot: fixture.repositoryRoot,
        runGameBuild: async ({ gameDirectory, basePath }) => {
            events.push("build");
            assert.equal(gameDirectory, fixture.gameDirectory);
            assert.equal(basePath, EXPECTED_GAME_BASE_PATH);
            await mkdir(path.join(fixture.gameDist, "assets"), { recursive: true });
            await writeFile(
                path.join(fixture.gameDist, "index.html"),
                '<script type="module" src="/games/LLM_Corpora/assets/game.js"></script>',
                "utf8",
            );
            await writeFile(path.join(fixture.gameDist, "assets", "game.js"), "game", "utf8");
        },
        stageBuild: async (input) => {
            events.push("stage");
            assert.equal(path.resolve(input.siteDist), fixture.siteDist);
            assert.equal(input.gameDist, fixture.gameDist);
            assert.equal(input.sourceCname, fixture.sourceCname);
            return stageLlmCorporaBuild(input);
        },
    });

    await integration.hooks["astro:build:done"]({
        assets: new Map(),
        dir: pathToFileURL(`${fixture.siteDist}${path.sep}`),
        logger: { info: (message) => logs.push(message) },
        pages: [],
    });

    assert.deepEqual(events, ["build", "stage"]);
    assert.equal(
        await readFile(path.join(fixture.siteDist, "games", "LLM_Corpora", "index.html"), "utf8"),
        '<script type="module" src="/games/LLM_Corpora/assets/game.js"></script>',
    );
    assert.equal(await readFile(path.join(fixture.siteDist, "CNAME"), "utf8"), `${CNAME_CONTENT}\n`);
    assert.equal(logs.some((message) => message.includes("games/LLM_Corpora")), true);
});

test("does not touch an existing staged game when the game build fails", async (context) => {
    const fixture = await createIntegrationFixture(context);
    const previousBuild = path.join(fixture.siteDist, "games", "LLM_Corpora", "previous.txt");
    let stageCalled = false;
    await mkdir(path.dirname(previousBuild), { recursive: true });
    await writeFile(previousBuild, "previous", "utf8");
    const integration = llmCorporaIntegration({
        repositoryRoot: fixture.repositoryRoot,
        runGameBuild: async () => {
            throw new Error("game build failed");
        },
        stageBuild: async () => {
            stageCalled = true;
            throw new Error("stage should not run");
        },
    });

    await assert.rejects(
        integration.hooks["astro:build:done"]({
            assets: new Map(),
            dir: pathToFileURL(`${fixture.siteDist}${path.sep}`),
            logger: { info: () => undefined },
            pages: [],
        }),
        /game build failed/,
    );

    assert.equal(stageCalled, false);
    assert.equal(await readFile(previousBuild, "utf8"), "previous");
    await assert.rejects(access(fixture.gameDist));
});

test("propagates staging validation failures through the Astro build hook", async (context) => {
    const fixture = await createIntegrationFixture(context);
    const stagingError = new Error("staging validation failed");
    const integration = llmCorporaIntegration({
        repositoryRoot: fixture.repositoryRoot,
        runGameBuild: async () => undefined,
        stageBuild: async () => {
            throw stagingError;
        },
    });

    await assert.rejects(
        integration.hooks["astro:build:done"]({
            assets: new Map(),
            dir: pathToFileURL(`${fixture.siteDist}${path.sep}`),
            logger: { info: () => undefined },
            pages: [],
        }),
        (error) => error === stagingError,
    );
});

async function createIntegrationFixture(context) {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), "astrologger-integration-"));
    const siteDist = path.join(repositoryRoot, "site-dist");
    const gameDirectory = path.join(repositoryRoot, "games", "LLM_Corpora");
    const gameDist = path.join(gameDirectory, "dist");
    const sourceCname = path.join(repositoryRoot, "public", "CNAME");

    context.after(() => rm(repositoryRoot, { recursive: true, force: true }));
    await mkdir(siteDist, { recursive: true });
    await mkdir(path.dirname(sourceCname), { recursive: true });
    await writeFile(path.join(siteDist, "index.html"), "site", "utf8");
    await writeFile(path.join(siteDist, "CNAME"), `${CNAME_CONTENT}\n`, "utf8");
    await writeFile(sourceCname, `${CNAME_CONTENT}\n`, "utf8");

    return { repositoryRoot, siteDist, gameDirectory, gameDist, sourceCname };
}
