import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
await mkdir('public/vendor',{recursive:true});
await build({stdin:{contents:"export * from '@mlc-ai/web-llm';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',target:'es2022',outfile:'public/vendor/webllm.js',minify:true,legalComments:'eof'});
console.log('Built optional on-device AI runtime.');
