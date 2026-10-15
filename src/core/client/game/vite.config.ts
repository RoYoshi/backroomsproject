/* The maintained client's build (Stage 3H continuation C4; docs/architecture/ADRS/ADR-002-client-bundle-source.md).
 *
 * The page has always loaded the compiled client as assets/index-DKbV5Nv9.js and its stylesheet as assets/index-D7hdwmUU.css: the
 * names v11's Vite build gave them, kept by every later change (the server sends code with "Cache-Control: no-store", so a name never
 * stands for one version).  The build keeps those two names, so public/index.html, the server's SERVE list and every tool that names
 * them stay as they are.  The PixiJS chunks keep Vite's usual names, [name]-[hash].js, which come out as v11's, except for the two
 * chunks that import the entry (PixiJS's browserAll and webworkerAll): their hash follows the entry's name, so they are given v11's
 * names too (V11_CHUNKS).  So the tree built before any port gives v11's dist/assets byte for byte.
 * The stylesheet: style.css (v11's own source) is built and minified as v11's build did it; client/style-after-v11.css, the rules the
 * steps after v11 added (readable), is appended to it as it is (appendLaterStyles; the file says why it skips the minifier).
 * Nothing from a public folder is copied: the textures the page loads (assets/carpet.png) are served from public/assets/ as they are.
 * (C4c, M-003) Level 0 and the carried lights are defined once, outside this folder, for the server and the page (level-data.cjs): each
 * of their constants is `define`d as its value, so the source names them and the built client holds the values, as before.
 * Built by dev/tools/build/client.js, which installs the locked packages offline and copies the outputs where they belong. */
import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const levelData = createRequire(import.meta.url)('./level-data.cjs') as { INPUTS: string[]; constants: (read: (p: string) => unknown) => Record<string, unknown> };
const REPO = fileURLToPath(new URL('../../../../', import.meta.url));      // the repository (or client.js's copy of it)
const DEFINE = Object.fromEntries(Object.entries(levelData.constants(p => JSON.parse(readFileSync(join(REPO, p), 'utf8')))).map(([k, v]) => [k, JSON.stringify(v)]));

const V11_CHUNKS: Record<string, string> = { browserAll: 'assets/browserAll-B-iwy0YI.js', webworkerAll: 'assets/webworkerAll-ByhiNG9W.js' };
const STYLESHEET = 'assets/index-D7hdwmUU.css';

function appendLaterStyles(): Plugin {
  const later = readFileSync(fileURLToPath(new URL('./client/style-after-v11.css', import.meta.url)), 'utf8');
  return {
    name: 'tfb-append-later-styles',
    apply: 'build',
    generateBundle(_options, bundle) {
      const sheet = bundle[STYLESHEET];
      if (!sheet || sheet.type !== 'asset') throw new Error(`the build made no ${STYLESHEET}`);
      sheet.source = (typeof sheet.source === 'string' ? sheet.source : new TextDecoder().decode(sheet.source)) + '\n' + later;
    },
  };
}

export default defineConfig({
  publicDir: false,
  define: DEFINE,
  server: { fs: { allow: ['.', ...levelData.INPUTS.map(p => join(REPO, p))] } },   // (the dev server: the definitions outside this folder)
  plugins: [appendLaterStyles()],
  build: {
    rolldownOptions: {
      output: {
        entryFileNames: 'assets/index-DKbV5Nv9.js',
        chunkFileNames: chunk => V11_CHUNKS[chunk.name] ?? 'assets/[name]-[hash].js',
        assetFileNames: asset => ((asset.names ?? []).some(n => n.endsWith('.css')) ? STYLESHEET : 'assets/[name]-[hash][extname]'),
      },
    },
  },
});
