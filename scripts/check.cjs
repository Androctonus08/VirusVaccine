'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
let count=0;
for(const root of ['src','scripts','tests']){const walk=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.(cjs|js)$/.test(file)){execFileSync(process.execPath,['--check',file],{stdio:'pipe'});count++;}}};walk(root);}
const html=fs.readFileSync('src/renderer/index.html','utf8');
if(!html.includes('Content-Security-Policy')||!html.includes("connect-src 'none'"))throw Error('Renderer CSP missing');
console.log(`Syntax validated for ${count} JavaScript files; local renderer CSP is present.`);
