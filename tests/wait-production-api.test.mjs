import test from "node:test";
import assert from "node:assert/strict";
import { probePublishedApi, awaitPublishedApi } from "../scripts/wait-production-api.mjs";
const manifest={version:"2025-10-26",stages:[{id:"stage-1"},{id:"stage-25",version:"2026-10-26-r1"}]};
const versions={seasonId:"2026",engineVersion:"2026-core-v4",languageVersion:"2026-v4",scoringVersion:"2026-v2"};
function fake({stale=false}={}){
  const calls=[];
  const fetcher=async(url,options)=>{
    const p=new URL(url);calls.push({p,origin:options.headers.Origin});
    if(p.pathname==="/api/health")return Response.json({ok:true,service:"kotogram-api",versions});
    if(stale&&p.searchParams.get("stageId")==="stage-25")return Response.json({error:"invalid_scope"},{status:400});
    return Response.json({ok:true,stageId:p.searchParams.get("stageId"),rows:[]});
  };
  return {fetcher,calls};
}
test("checks live API and each latest stage version",async()=>{
  const {fetcher,calls}=fake();
  assert.equal(await probePublishedApi(manifest,fetcher),2);
  assert.deepEqual(calls.slice(1).map(x=>x.p.searchParams.get("stageVersion")),["2025-10-26","2026-10-26-r1"]);
  assert.ok(calls.every(x=>x.origin==="https://kotogram.sae-chan.net"));
});
test("blocks frontend when API still rejects the new scope",async()=>{
  const {fetcher}=fake({stale:true});
  await assert.rejects(probePublishedApi(manifest,fetcher),/stage-25: HTTP 400/);
  await assert.rejects(awaitPublishedApi(manifest,fetcher,2,0),/stage-25: HTTP 400/);
});
test("retries until API has deployed",async()=>{
  const a=fake({stale:true}),b=fake();
  let tries=0;
  const fetcher=(...args)=>{
    if(new URL(args[0]).pathname==="/api/health")tries++;
    return (tries===1?a:b).fetcher(...args);
  };
  assert.equal(await awaitPublishedApi(manifest,fetcher,2,0),2);
  assert.equal(tries,2);
});
