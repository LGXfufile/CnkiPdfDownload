const { defineConfig } = require('@vue/cli-service')
const CopyPlugin = require('copy-webpack-plugin')
const path = require('path')

module.exports = defineConfig({
  pages: {
    popup: {
      template: 'public/index.html',
      entry: './src/popup/main.js',
      filename: 'popup.html'
    }
  },
  configureWebpack: {
    entry: {
      content: './src/content.js',
      background: './src/background.js'
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist')
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: 'src/manifest.json', to: 'manifest.json' },
          { from: 'src/assets', to: 'assets' },
          { from: 'src/content.css', to: 'content.css' }
        ]
      })
    ]
  },
  filenameHashing: false,
  productionSourceMap: false
})
