const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// mapbox-gl is loaded from a CDN in public/index.html, so we never want Metro
// to bundle it. @rnmapbox/maps lists mapbox-gl as an optional peer dep for web
// and Metro follows that chain, hitting a dynamic `import()` inside mapbox-gl
// that it can't parse. Resolve mapbox-gl to an empty module on web.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'mapbox-gl' && platform === 'web') {
    return { type: 'empty' };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
