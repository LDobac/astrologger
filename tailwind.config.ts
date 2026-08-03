import type { Config } from "tailwindcss"
import defaultTheme from "tailwindcss/defaultTheme";

// 시맨틱 색상 토큰. 값은 Layout.astro의 :root / :root.dark에서 RGB 채널값으로 정의한다.
// <alpha-value> 형식이라야 bg-accent-subtle/20 같은 투명도 수식어가 동작한다.
const token = (name: string) => `rgb(var(--color-${name}) / <alpha-value>)`;

let config: Config = {
    darkMode: "class",
    content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Noto Sans KR", ...defaultTheme.fontFamily.sans]
            },
            colors: {
                canvas: {
                    DEFAULT: token("canvas"),
                    subtle: token("canvas-subtle"),
                },
                fg: {
                    DEFAULT: token("fg"),
                    muted: token("fg-muted"),
                },
                line: token("line"),
                accent: {
                    DEFAULT: token("accent"),
                    subtle: token("accent-subtle"),
                },
            },
        },
    },
    plugins: [],
}

export default config; 
