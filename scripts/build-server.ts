import { build } from 'esbuild';

build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile: 'dist/server.js',
  format: 'cjs',
  external: ['next', 'react', 'react-dom'],
  sourcemap: true,
}).then(() => {
  console.log('Server built to dist/server.js');
});
