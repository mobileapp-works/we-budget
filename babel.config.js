module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated/plugin は必ずプラグイン配列の最後に置く（公式要件）
    plugins: ['react-native-reanimated/plugin'],
  };
};
