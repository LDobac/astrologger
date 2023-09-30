import type { Config } from "tailwindcss"
import defaultTheme from "tailwindcss/defaultTheme";

let config: Config = {
    content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Noto Sans KR", ...defaultTheme.fontFamily.sans]
            }
        },
    },
    plugins: [],
}

export default config; 
