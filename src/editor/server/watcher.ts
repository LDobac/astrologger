import type { ViteDevServer } from "vite";

let watcher: ViteDevServer["watcher"] | null = null;

export function setWatcher(next: ViteDevServer["watcher"]) {
    watcher = next;
}

export function notifyFileEvent(event: "add" | "change" | "unlink", file: string) {
    watcher?.emit(event, file);
}
