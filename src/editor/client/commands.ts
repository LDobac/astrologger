import { EditorSelection, type ChangeSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

export function toggleWrap(view: EditorView, marker: string): boolean {
    const { state } = view;
    const len = marker.length;
    view.dispatch(
        state.changeByRange((range) => {
            const before = state.sliceDoc(range.from - len, range.from);
            const after = state.sliceDoc(range.to, range.to + len);
            if (before === marker && after === marker) {
                return {
                    changes: [
                        { from: range.from - len, to: range.from },
                        { from: range.to, to: range.to + len },
                    ],
                    range: EditorSelection.range(range.from - len, range.to - len),
                };
            }
            const text = state.sliceDoc(range.from, range.to);
            if (text.length >= len * 2 && text.startsWith(marker) && text.endsWith(marker)) {
                return {
                    changes: { from: range.from, to: range.to, insert: text.slice(len, -len) },
                    range: EditorSelection.range(range.from, range.to - len * 2),
                };
            }
            return {
                changes: [
                    { from: range.from, insert: marker },
                    { from: range.to, insert: marker },
                ],
                range: EditorSelection.range(range.from + len, range.to + len),
            };
        }),
    );
    view.focus();
    return true;
}

export function insertLink(view: EditorView, text?: string, url?: string): boolean {
    const { state } = view;
    view.dispatch(
        state.changeByRange((range) => {
            const label = text ?? (state.sliceDoc(range.from, range.to) || "링크");
            const target = url ?? "https://";
            const insert = `[${label}](${target})`;
            const urlFrom = range.from + label.length + 3;
            return {
                changes: { from: range.from, to: range.to, insert },
                range: url
                    ? EditorSelection.cursor(range.from + insert.length)
                    : EditorSelection.range(urlFrom, urlFrom + target.length),
            };
        }),
    );
    view.focus();
    return true;
}

export function setHeading(view: EditorView, level: number): boolean {
    const { state } = view;
    const changes: ChangeSpec[] = [];
    const seen = new Set<number>();
    for (const range of state.selection.ranges) {
        for (let pos = range.from; pos <= range.to; ) {
            const line = state.doc.lineAt(pos);
            if (!seen.has(line.number)) {
                seen.add(line.number);
                const match = /^(#{1,6})\s+/.exec(line.text);
                const current = match ? match[1].length : 0;
                const prefix = current === level ? "" : `${"#".repeat(level)} `;
                changes.push({ from: line.from, to: line.from + (match ? match[0].length : 0), insert: prefix });
            }
            pos = line.to + 1;
        }
    }
    view.dispatch({ changes });
    view.focus();
    return true;
}

export function insertCodeBlock(view: EditorView): boolean {
    const { state } = view;
    view.dispatch(
        state.changeByRange((range) => {
            const text = state.sliceDoc(range.from, range.to);
            const lineStart = state.doc.lineAt(range.from).from === range.from;
            const lead = lineStart ? "" : "\n";
            const insert = `${lead}\`\`\`\n${text}\n\`\`\`\n`;
            const langPos = range.from + lead.length + 3;
            return {
                changes: { from: range.from, to: range.to, insert },
                range: EditorSelection.cursor(langPos),
            };
        }),
    );
    view.focus();
    return true;
}

export function insertText(view: EditorView, text: string): void {
    view.dispatch(view.state.replaceSelection(text));
    view.focus();
}
