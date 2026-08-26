import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { stageLlmCorporaBuild } from "./stage-llm-corpora.mjs";

const CNAME_CONTENT = "fixture.example";
const GAME_ROUTE = path.join("games", "LLM_Corpora");
const GAME_BASE_PATH = "/games/LLM_Corpora/";

test("lets the Astro build lifecycle own game compilation and deployment staging", async () => {
    const packageJson = JSON.parse(
        await readFile(new URL("../package.json", import.meta.url), "utf8"),
    );
    const astroConfig = await readFile(new URL("../astro.config.ts", import.meta.url), "utf8");

    assert.equal(packageJson.scripts.build, "astro check && tsc --noEmit && astro build");
    assert.equal(packageJson.scripts["build:site"], undefined);
    assert.equal(packageJson.scripts["build:game"], undefined);
    assert.equal(packageJson.scripts["stage:game"], undefined);
    assert.match(astroConfig, /import llmCorporaIntegration from "\.\/scripts\/llm-corpora-integration\.mjs"/);
    assert.match(astroConfig, /integrations: \[sitemap\(\), llmCorporaIntegration\(\)\]/);
    assert.match(astroConfig, /public\/CNAME/);
    assert.doesNotMatch(astroConfig, /https:\/\/jaehee\.dev/);
});

test("replaces the staged game while preserving the Astro site root", async (context) => {
    const fixture = await createFixture(context);
    const staleFile = path.join(fixture.siteDist, GAME_ROUTE, "assets", "stale.js");

    await mkdir(path.dirname(staleFile), { recursive: true });
    await writeFile(staleFile, "stale", "utf8");
    await writeFile(path.join(fixture.gameDist, "assets", "game.js"), "game", "utf8");

    const result = await stageLlmCorporaBuild({
        siteDist: fixture.siteDist,
        gameDist: fixture.gameDist,
        sourceCname: fixture.sourceCname,
    });

    assert.equal(result.destination, path.join(fixture.siteDist, GAME_ROUTE));
    assert.equal(await readFile(path.join(fixture.siteDist, "index.html"), "utf8"), "site");
    assert.equal(await readFile(path.join(fixture.siteDist, "CNAME"), "utf8"), `${CNAME_CONTENT}\n`);
    assert.equal(
        await readFile(path.join(result.destination, "index.html"), "utf8"),
        `<script type="module" src="${GAME_BASE_PATH}assets/game.js"></script>`,
    );
    assert.equal(await readFile(path.join(result.destination, "assets", "game.js"), "utf8"), "game");
    await assert.rejects(access(staleFile));
});

test("keeps the previous staged game when the new game build is incomplete", async (context) => {
    const fixture = await createFixture(context);
    const destination = path.join(fixture.siteDist, GAME_ROUTE);
    const previousBuild = path.join(destination, "previous.txt");

    await rm(path.join(fixture.gameDist, "index.html"));
    await mkdir(destination, { recursive: true });
    await writeFile(previousBuild, "previous", "utf8");

    await assert.rejects(
        stageLlmCorporaBuild({
            siteDist: fixture.siteDist,
            gameDist: fixture.gameDist,
            sourceCname: fixture.sourceCname,
        }),
        /game build is incomplete/i,
    );
    assert.equal(await readFile(previousBuild, "utf8"), "previous");
});

test("rejects Git LFS pointer files before replacing the staged game", async (context) => {
    const fixture = await createFixture(context);
    const destination = path.join(fixture.siteDist, GAME_ROUTE);
    const previousBuild = path.join(destination, "previous.txt");
    const pointerFile = path.join(fixture.gameDist, "assets", "runtime", "music.ogg");

    await mkdir(destination, { recursive: true });
    await writeFile(previousBuild, "previous", "utf8");
    await mkdir(path.dirname(pointerFile), { recursive: true });
    await writeFile(
        pointerFile,
        "version https://git-lfs.github.com/spec/v1\noid sha256:0123456789abcdef\nsize 123\n",
        "utf8",
    );

    await assert.rejects(
        stageLlmCorporaBuild({
            siteDist: fixture.siteDist,
            gameDist: fixture.gameDist,
            sourceCname: fixture.sourceCname,
        }),
        /Git LFS pointer/i,
    );
    assert.equal(await readFile(previousBuild, "utf8"), "previous");
});

test("rejects a relative game base that breaks the route without a trailing slash", async (context) => {
    const fixture = await createFixture(context);
    const destination = path.join(fixture.siteDist, GAME_ROUTE);
    const previousBuild = path.join(destination, "previous.txt");

    await mkdir(destination, { recursive: true });
    await writeFile(previousBuild, "previous", "utf8");
    await writeFile(
        path.join(fixture.gameDist, "index.html"),
        '<script type="module" src="./assets/game.js"></script>',
        "utf8",
    );

    await assert.rejects(
        stageLlmCorporaBuild({
            siteDist: fixture.siteDist,
            gameDist: fixture.gameDist,
            sourceCname: fixture.sourceCname,
        }),
        /deployment base path/i,
    );
    assert.equal(await readFile(previousBuild, "utf8"), "previous");
});

test("requires the generated CNAME to match public/CNAME before staging", async (context) => {
    const fixture = await createFixture(context);

    await writeFile(path.join(fixture.siteDist, "CNAME"), "unexpected.example\n", "utf8");

    await assert.rejects(
        stageLlmCorporaBuild({
            siteDist: fixture.siteDist,
            gameDist: fixture.gameDist,
            sourceCname: fixture.sourceCname,
        }),
        /does not match/i,
    );
});

async function createFixture(context) {
    const root = await mkdtemp(path.join(tmpdir(), "astrologger-stage-game-"));
    const siteDist = path.join(root, "site-dist");
    const gameDist = path.join(root, "game-dist");
    const sourceCname = path.join(root, "public", "CNAME");

    context.after(() => rm(root, { recursive: true, force: true }));
    await mkdir(path.join(gameDist, "assets"), { recursive: true });
    await mkdir(siteDist, { recursive: true });
    await mkdir(path.dirname(sourceCname), { recursive: true });
    await writeFile(path.join(siteDist, "index.html"), "site", "utf8");
    await writeFile(path.join(siteDist, "CNAME"), `${CNAME_CONTENT}\n`, "utf8");
    await writeFile(sourceCname, `${CNAME_CONTENT}\n`, "utf8");
    await writeFile(
        path.join(gameDist, "index.html"),
        `<script type="module" src="${GAME_BASE_PATH}assets/game.js"></script>`,
        "utf8",
    );

    return { gameDist, siteDist, sourceCname };
}
