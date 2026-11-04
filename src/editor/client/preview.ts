import type { PostMeta } from "../types";

export type PreviewMessage =
    | { type: "render"; html: string; meta: PostMeta; ogUrl: string | null; thumbUrl: string | null; dark: boolean }
    | { type: "scroll"; ratio: number }
    | { type: "ready" };

export class PreviewBridge {
    private last: PreviewMessage | null = null;

    constructor(private frame: HTMLIFrameElement) {
        window.addEventListener("message", (event) => {
            if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
            if ((event.data as PreviewMessage).type === "ready") this.resend();
        });
        frame.addEventListener("load", () => this.resend());
    }

    private resend() {
        if (this.last) this.send(this.last);
    }

    private send(msg: PreviewMessage) {
        this.frame.contentWindow?.postMessage(msg, location.origin);
    }

    post(msg: PreviewMessage) {
        if (msg.type === "render") this.last = msg;
        this.send(msg);
    }
}
