import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {FRONTEND_ORIGIN,PRODUCTION_API_ORIGIN} from "./preflight-frontend.mjs";

export async function probePublishedApi(manifest,fetcher=fetch) {
  const request=path=>fetcher(PRODUCTION_API_ORIGIN+path,{headers:{Origin:FRONTEND_ORIGIN},signal:AbortSignal.timeout(12000)});
  const health=await request("/api/health");
  if(!health.ok)throw new Error("API health status "+health.status);
  const data=await health.json();
  if(data.ok!==true||data.service!=="kotogram-api")throw new Error("API health mismatch");
  const versions=data.versions;
  if(!versions||["seasonId","engineVersion","languageVersion","scoringVersion"].some(key=>typeof versions[key]!=="string"))throw new Error("API versions unavailable");
  for(let i=0;i<manifest.stages.length;i+=5){
    await Promise.all(manifest.stages.slice(i,i+5).map(async stage=>{
      const params=new URLSearchParams({...versions,stageId:stage.id,stageVersion:stage.version??manifest.version,type:"time",limit:"1"});
      const response=await request("/api/stages/"+stage.id+"/rankings?"+params);
      if(!response.ok)throw new Error(stage.id+": HTTP "+response.status);
      const result=await response.json();
      if(result.ok!==true||result.stageId!==stage.id||!Array.isArray(result.rows))throw new Error(stage.id+": invalid ranking data");
    }));
  }
  return manifest.stages.length;
}

export async function awaitPublishedApi(manifest,fetcher=fetch,attempts=30,interval=5000) {
  for(let n=0;n<attempts;n++){
    try{return await probePublishedApi(manifest,fetcher);}
    catch(error){
      if(n===attempts-1)throw error;
      console.log("Waiting for deployed API:",String(error));
      await new Promise(resolve=>setTimeout(resolve,interval));
    }
  }
  throw new Error("No attempts");
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const manifest=JSON.parse(readFileSync(new URL("../public/stages/manifest.json",import.meta.url),"utf8"));
  try{const count=await awaitPublishedApi(manifest);console.log("API ready for "+count+" published stages");}
  catch(error){console.error(error);process.exitCode=1;}
}
