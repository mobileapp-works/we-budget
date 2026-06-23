module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets/plugin は必ずプラグイン配列の最後に置く（Reanimated 4の要件）
    plugins: ['react-native-worklets/plugin'],
  };
};
