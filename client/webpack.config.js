const { composePlugins, withAngular } = require('@angular-devkit/build-angular');

module.exports = composePlugins(withAngular(), (config) => {
  // Handle font files from katex and other node_modules
  config.module.rules.push({
    test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
    type: 'asset/resource',
    generator: {
      filename: 'assets/katex-fonts/[name][ext]',
    },
  });
  return config;
});
