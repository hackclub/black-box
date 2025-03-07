import { nodeResolve } from "@rollup/plugin-node-resolve"
import terser from '@rollup/plugin-terser';

export default {
  input: "./codemirror.mjs",
  output: [
    {
      file: "./codemirror.bundle.js",
      format: "iife"
    },
    {
      file: './codemirror.bundle.min.js',
      format: 'iife',
      plugins: [terser()]
    }
  ],
  plugins: [nodeResolve()]
}
