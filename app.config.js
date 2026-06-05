// Extends the static configuration in app.json so we can inject the Mapbox
// download token from an environment variable at build time. EAS resolves
// MAPBOX_DOWNLOAD_TOKEN from project secrets (scope: project, environment:
// preview/production).
const staticConfig = require('./app.json').expo;

/** @type {import('@expo/config-types').ExpoConfig} */
module.exports = {
  ...staticConfig,
  plugins: [
    ...(staticConfig.plugins || []),
    [
      '@rnmapbox/maps',
      {
        RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOAD_TOKEN,
      },
    ],
  ],
};
