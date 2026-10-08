import { spawnSync,spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
const compile=spawnSync(process.execPath,['node_modules/typescript/bin/tsc','-p','tsconfig.runtime.json'],{stdio:'inherit'});
if(compile.status!==0)process.exit(compile.status||1);
const args=process.argv[2]==='test'?['--experimental-sqlite','--test',...readdirSync('.runtime/tests').filter(f=>f.endsWith('.test.js')).map(f=>'.runtime/tests/'+f)]:['--experimental-sqlite','.runtime/server/index.js'];
const child=spawn(process.execPath,['--dns-result-order=ipv4first',...args],{stdio:'inherit'});
child.on('exit',code=>process.exit(code||0));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
