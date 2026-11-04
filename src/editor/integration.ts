import type { AstroIntegration } from "astro";
import { handleApi } from "./server/api";
import { setRenderConfig } from "./server/render";
import { setWatcher } from "./server/watcher";

export default function editor(): AstroIntegration {
    let enabled = false;

    return {
        name: "astrologger-editor",
        hooks: {
            "astro:config:setup": ({ command, injectRoute }) => {
                enabled = command === "dev";
                if (!enabled) return;

                injectRoute({ pattern: "/__editor", entrypoint: "./src/editor/pages/TreePage.astro" });
                injectRoute({ pattern: "/__editor/edit", entrypoint: "./src/editor/pages/EditPage.astro" });
                injectRoute({ pattern: "/__editor/preview", entrypoint: "./src/editor/pages/PreviewPage.astro" });
            },
            "astro:config:done": ({ config }) => {
                if (enabled) setRenderConfig(config);
            },
            "astro:server:setup": ({ server }) => {
                if (!enabled) return;

                setWatcher(server.watcher);
                server.middlewares.use("/__editor/api", (req, res) => {
                    void handleApi(req, res);
                });
            },
        },
    };
}
