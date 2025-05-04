// forge.config.js
const { FusesPlugin } = require("@electron-forge/plugin-fuses");
const { FuseV1Options, FuseVersion } = require("@electron/fuses");

module.exports = {
  
  packagerConfig: {
    asar: true,
    icon: "assets/mirrorbast-icon", // Base name (without extension)
    /** 🔑  Ad‑hoc signing on macOS, nothing on other platforms */
    osxSign: {},
    // No osxNotarize block – we are intentionally *not* notarising
  },

  /** -----------------------------------------------------------
   *  Rebuild config (native modules)
   *  ---------------------------------------------------------- */
  rebuildConfig: {},

  /** -----------------------------------------------------------
   *  Makers – one per target platform
   *  ---------------------------------------------------------- */
  makers: [
    // Windows (Squirrel)
    {
      name: "@electron-forge/maker-squirrel",
      config: {}, // Add signing options here if you later need them
    },
    // macOS – we ship a ZIP, which GitHub Actions then zips again
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    // Ubuntu / Debian
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: { icon: "assets/mirrorbast-icon.png" },
      },
    },
  ],

  /** -----------------------------------------------------------
   *  Plugins
   *  ---------------------------------------------------------- */
  plugins: [
    // Automatically unpack native add‑ons from ASAR at runtime
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },

    // Harden the Electron binary with fuse settings
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
