const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.watcher = {
  ...config.watcher,
  watchman: {
    deferStates: [],
  },
  healthCheck: {
    enabled: false,
  },
};

// Custom transformer strips import(OTEL_PKG) from @supabase before hermesc sees it.
// @supabase/supabase-js uses a dynamic import() with a variable argument to lazy-load
// OpenTelemetry, which Hermes cannot compile in preview/production builds.
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('./metro-transformer.js'),
};

module.exports = config;
