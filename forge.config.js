const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: 'assets/mirrorbast-icon' // Base name for icons
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {}, // Windows specific config (including signing) goes here
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        icon: 'assets/mirrorbast-icon.icns', // Specific icon for DMG
        format: 'ULFO'
      },
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: { icon: 'assets/mirrorbast-icon.png' }, // Specific icon for DEB
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
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
