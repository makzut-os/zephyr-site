import { request } from 'node:https';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(fileURLToPath(new URL('.',import.meta.url)));
const base='https://localhost:5173';

function call(path,{method='GET',body=null,headers={}}={}){
  return new Promise((resolveCall,reject)=>{
    const started=performance.now();
    const payload=body===null?null:JSON.stringify(body);
    const req=request(`${base}${path}`,{method,rejectUnauthorized:false,headers:{...(payload?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}:{}),...headers}},response=>{
      const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolveCall({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks),ms:performance.now()-started}));
    });
    req.on('error',reject);if(payload)req.write(payload);req.end();
  });
}

const origin={Origin:base};
const main=await call('/');
const privacy=await call('/privacy.html');
const robots=await call('/robots.txt');
const sitemap=await call('/sitemap.xml');
const missing=await call('/not-a-real-page');
const serverSource=await call('/server.mjs');
const environmentFile=await call('/.env.example');
const created=await call('/api/feedback',{method:'POST',headers:origin,body:{topic:'Ошибка',message:'Тестовое обращение для проверки валидации и удаления данных сайта.',contact:'',website:'',startedAt:Date.now()-5000,privacyConsent:true,ageConfirmed:true}});
const receipt=JSON.parse(created.body.toString('utf8'));
const deleted=await call(`/api/feedback/${receipt.id}`,{method:'DELETE',headers:origin,body:{deleteToken:receipt.deleteToken}});
const honeypot=await call('/api/feedback',{method:'POST',headers:origin,body:{topic:'Ошибка',message:'Honeypot request that must never be stored by the server.',contact:'',website:'spam-bot',startedAt:0,privacyConsent:true,ageConfirmed:true}});
const invalid=await call('/api/feedback',{method:'POST',headers:origin,body:{topic:'Ошибка',message:'short',contact:'',website:'',startedAt:Date.now()-5000,privacyConsent:false,ageConfirmed:false}});
const limited=await call('/api/feedback',{method:'POST',headers:origin,body:{topic:'Ошибка',message:'Fourth request used to verify rate limiting on the feedback endpoint.',contact:'',website:'',startedAt:Date.now()-5000,privacyConsent:true,ageConfirmed:true}});
const analytics=await call('/api/analytics',{method:'POST',headers:origin,body:{event:'page_view',consent:'analytics'}});

const expected=[[main,200],[privacy,200],[robots,200],[sitemap,200],[missing,404],[serverSource,404],[environmentFile,404],[created,201],[deleted,200],[honeypot,202],[invalid,400],[limited,429],[analytics,204]];
if(expected.some(([result,status])=>result.status!==status))throw new Error(`Unexpected statuses: ${expected.map(([result,status])=>`${result.status}/${status}`).join(', ')}`);
const html=main.body.toString('utf8');
if(!html.includes('og:image')||!html.includes('meta name="description"'))throw new Error('SEO metadata missing');
if(!main.headers['content-security-policy']||!main.headers['strict-transport-security'])throw new Error('Security headers missing');

const initialFiles=['index.html','styles.css','app.js','assets/Zephyr.ico','assets/zephyr-main-7.1.0.png'];
const initialBytes=(await Promise.all(initialFiles.map(file=>stat(resolve(root,file))))).reduce((sum,item)=>sum+item.size,0);
const report={https:true,statuses:{home:main.status,privacy:privacy.status,robots:robots.status,sitemap:sitemap.status,custom404:missing.status,serverSourceBlocked:serverSource.status,environmentFileBlocked:environmentFile.status,feedbackCreated:created.status,feedbackDeleted:deleted.status,honeypot:honeypot.status,validation:invalid.status,rateLimit:limited.status,analytics:analytics.status},security:{csp:true,hsts:true},speed:{homeTlsAndResponseMs:Number(main.ms.toFixed(1)),initialPayloadBytes:initialBytes},author:'https://t.me/Makzut_Replaces'};
console.log(JSON.stringify(report));
