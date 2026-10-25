import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../app/game/core.ts";
import { snapshotGameAudio, gameAudioEvents } from "../app/game/audio-events.ts";
import { generateSecretCueWav } from "../app/game/secret-sfx.ts";
const stage={goal:850,scrollSpeed:3,objects:[{type:"door",id:"gate",position:450,breakable:true,vaultable:true}]};
test("secret break and vault get unique cues without duplicating ordinary gate confirm",()=>{
 const broken=createGame(stage),before=snapshotGameAudio(broken);
 broken.doors[0].broken=true;
 broken.doors[0].open=true;
 assert.deepEqual(gameAudioEvents(before,broken),["door_break"]);
 assert.deepEqual(gameAudioEvents(snapshotGameAudio(broken),broken),[]);
 const vaulted=createGame(stage),other=snapshotGameAudio(vaulted);
 vaulted.doors[0].vaulted=true;
 assert.deepEqual(gameAudioEvents(other,vaulted),["door_vault"]);
 const opened=createGame(stage),start=snapshotGameAudio(opened);
 opened.doors[0].open=true;
 assert.deepEqual(gameAudioEvents(start,opened),["confirm"]);
});
test("generated secret cue wav files have valid size, header and deterministic audio",()=>{
 const breakSfx=generateSecretCueWav("door_break");
 const vaultSfx=generateSecretCueWav("door_vault");
 for(const samples of [breakSfx,vaultSfx]){
  const view=new DataView(samples.buffer);
  const ascii=(a,b)=>String.fromCharCode(...samples.slice(a,b));
  assert.equal(ascii(0,4),"RIFF");
  assert.equal(ascii(8,12),"WAVE");
  assert.equal(ascii(36,40),"data");
  assert.equal(view.getUint32(4,true)+8,samples.length);
  assert.equal(view.getUint32(24,true),24000);
  assert.equal(view.getUint32(40,true),samples.length-44);
  assert.ok(samples.slice(44).some(x=>x!==0));
 }
 assert.deepEqual(breakSfx,generateSecretCueWav("door_break"));
 assert.notDeepEqual(breakSfx,vaultSfx);
});
