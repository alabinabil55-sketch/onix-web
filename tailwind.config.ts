import type { Config } from "tailwindcss";
const config: Config = { content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"], theme: { extend: {
 colors: { ink:"#090A0F", panel:"#12141D", line:"#252837", violet:"#9B7BFF", muted:"#9699AA" },
 boxShadow: { glow:"0 0 35px rgba(155,123,255,.18)" }
}}, plugins: [] };
export default config;
