module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // El plugin de Reanimated/Worklets lo añade automáticamente babel-preset-expo
    // (ver docs Expo SDK 57 → react-native-reanimated: "No additional configuration is required").
    plugins: [
      ['module-resolver', {
        root: ['.'],
        alias: {
          '@': './src',
          '@/components': './src/components',
          '@/hooks': './src/hooks',
          '@/utils': './src/utils',
          '@/stores': './src/stores',
          '@/types': './src/types',
          '@/db': './src/db',
          '@/schemas': './src/schemas',
          '@/services': './src/services',
          '@/constants': './src/constants',
        },
      }],
    ],
  };
};