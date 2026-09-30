import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

const test = process.argv.includes("--test");
const RELAY = process.env.SYNAPSE_RELAY_URL || "https://synapse-adaptive.vercel.app/api/relay";
mkdirSync("dist", { recursive: true });

const common = { bundle: true, platform: "node", target: "node20", format: "cjs", sourcemap: false, logLevel: "warning" };
await build({ ...common, entryPoints: ["src/main.ts"], outfile: "dist/main.js", external: ["electron", "koffi"], define: { __RELAY_URL__: JSON.stringify(RELAY) } });
await build({ ...common, entryPoints: ["src/preload.ts"], outfile: "dist/preload.js", external: ["electron"] });
cpSync("src/orb", "dist/orb", { recursive: true });
if (test) await build({ ...common, entryPoints: ["test/core.test.ts"], outfile: "dist/core.test.js" });
console.log(`built (relay: ${RELAY})`);
