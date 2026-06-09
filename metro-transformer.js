const babelTransformer = require('@expo/metro-config/babel-transformer')

module.exports.transform = async function transform(params) {
  if (params.filename.includes('@supabase')) {
    // Hermes cannot compile dynamic import() with a variable argument.
    // @supabase/supabase-js uses import(OTEL_PKG) to lazy-load OpenTelemetry.
    // Replace with Promise.resolve(null) — OTel is never used in React Native.
    params.src = params.src.replace(
      /\bimport\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*OTEL_PKG\s*\)/g,
      'Promise.resolve(null)'
    )
  }
  return babelTransformer.transform(params)
}
