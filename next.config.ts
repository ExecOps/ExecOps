import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: [
    "@codemirror/state",
    "@codemirror/view",
    "@codemirror/language",
    "@codemirror/lang-yaml",
    "@codemirror/commands",
    "@lezer/highlight",
    "@lezer/common",
    "@lezer/yaml",
    "@uiw/react-codemirror",
    "@uiw/codemirror-extensions-basic-setup",
  ],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
