import{readFile,access,readdir}from'node:fs/promises';import{createHash}from'node:crypto';import path from'node:path';import{fileURLToPath}from'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(path.join(root,'vendor/app-ui-manifest.json'),'utf8')),pkg=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')),lock=JSON.parse(await readFile(path.join(root,'package-lock.json'),'utf8'));
const sha='sha512-'+createHash('sha512').update(await readFile(path.join(root,'vendor',manifest.fileName))).digest('base64');if(sha!==manifest.integrity||lock.packages['node_modules/@3gaspo/app-ui']?.integrity!==sha)throw new Error('UI archive differs from its lockfile');
if(pkg.dependencies['@3gaspo/app-ui']!=='file:vendor/'+manifest.fileName)throw new Error('UI dependency version mismatch');
const installed=path.join(root,'node_modules/@3gaspo/app-ui');const map=JSON.parse(await readFile(path.join(installed,'consumer-map.json'),'utf8'));
for(const[file,expected]of Object.entries(manifest.files)){const actual=createHash('sha256').update(await readFile(path.join(installed,file))).digest('hex');if(actual!==expected)throw new Error(`Installed UI differs: ${file}. Run npm ci.`);}
for(const name of map.components){const file=path.join(root,'src/components',name+'.tsx');try{await access(file);}catch{continue;}if((await readFile(file,'utf8')).replaceAll('\r\n','\n')!==`export * from '@3gaspo/app-ui/${name}';\n`)throw new Error(`Edit ${name} in app-ui, not its consumer bridge`);}
for(const name of map.styles)if((await readFile(path.join(root,'src/styles',name+'.css'),'utf8')).replaceAll('\r\n','\n')!==`@import "@3gaspo/app-ui/styles/${name}.css";\n`)throw new Error(`Edit ${name}.css in app-ui`);
console.log(`UI ${manifest.version} verified (${manifest.sourceHash.slice(0,12)}).`);
