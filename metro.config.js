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

module.exports = config;
