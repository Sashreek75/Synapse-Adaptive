// macOS: without an Apple Developer ID the app is unsigned, and Apple Silicon refuses to run
// unsigned code ("Synapse is damaged"). An ad-hoc signature fixes that; Gatekeeper will still
// ask the user to confirm the first launch. Replace with real signing once there's a Developer ID.
const { execSync } = require("node:child_process");
const path = require("node:path");
exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== "darwin") return;
  const app = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.app`);
  execSync(`codesign --force --deep --sign - "${app}"`, { stdio: "inherit" });
};
