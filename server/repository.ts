import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
const execute=promisify(execFile);
async function command(binary:string,args:string[]){return (await execute(binary,args,{timeout:15000,maxBuffer:1024*1024,windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}})).stdout.trim();}
export async function checkRepository(){const git=(...args:string[])=>command('git',['-c',`safe.directory=${resolve('.')}`,...args]);
 let cli=false,manager=false;try{await command('gh',['--version']);cli=true;}catch{}try{manager=(await git('config','--get','credential.helper')).includes('manager');}catch{}
 let audit:any;try{audit=JSON.parse(await command(process.execPath,['scripts/verify-history.mjs']));}catch{audit={passed:false,detail:'History inspection did not pass. No push performed.'};}
 let remote='';try{remote=await git('config','--get','remote.origin.url');}catch{}
 const checked=new Date().toISOString();const tools={githubCLI:cli,credentialManager:manager};
 if(!remote)return {status:'Not configured',detail:'Choose an existing private GitHub repository and add its token-free origin URL. No push performed.',checked,tools,audit,pushed:false};
 const parsed=remote.match(/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?$/)||remote.match(/^git@github\.com:([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
 if(!parsed)return {status:'Needs attention',detail:'Origin must be a supported token-free GitHub HTTPS or SSH URL. Its value is withheld.',checked,tools,audit,pushed:false};
 const repo=parsed[1]+'/'+parsed[2],url='https://github.com/'+repo;
 if(!audit.passed)return {status:'Needs attention',detail:'Tracked/history inspection failed. No push permitted.',checked,tools,audit,url,pushed:false};
 if(!cli)return {status:'Configured but unverified',detail:'Git origin exists; repository privacy and authenticated access are unverified. Git Credential Manager can handle Git transport, but GitHub CLI is unavailable for the privacy check. No push performed.',checked,tools,audit,url,pushed:false};
 try{const metadata=JSON.parse(await command('gh',['api','repos/'+repo,'--jq','{private:.private}']));if(metadata.private!==true)return {status:'Needs attention',detail:'Repository is not confirmed private. No push permitted.',checked,tools,audit,url,pushed:false};const refs=await git('ls-remote','origin','refs/heads/main');const local=await git('rev-parse','HEAD');return {status:'Verified',detail:'Authenticated private repository access verified. No push performed by this check.',checked,tools,audit,url,pushed:false,branchMatchesLocal:refs.split(/\s+/)[0]===local};}catch{return {status:'Needs attention',detail:'Complete GitHub authentication with gh auth login --web, then recheck the selected private repository. No push performed.',checked,tools,audit,url,pushed:false};}
}
