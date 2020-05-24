module.exports = (api) => {
  const isESM = api.env('esm')

  return {
    presets: [
      [
        "@babel/preset-env",
        {
          modules: isESM ? false : 'commonjs',
          targets: isESM ? {esmodules: true} : {node: '8'}
        }
      ],
      "@babel/preset-react"
    ]
  }
}
