import { writeFileSync } from "node:fs";

export function renderTitleAdventure() {
  const rate=32000,bpm=112,beat=60/bpm,bars=8,seconds=bars*4*beat;
  const count=Math.round(seconds*rate);
  const mix=new Float32Array(count);
  const hz=(m)=>440*Math.pow(2,(m-69)/12);
  function tone(midi,start,duration,amp,kind) {
    const freq=hz(midi),begin=Math.round(start*rate),length=Math.round(duration*rate);
    for(let i=0;i<length && begin+i<count;i++){
      const t=i/rate,ph=2*Math.PI*freq*t;
      const attack=Math.min(1,t/(kind==="pad"||kind==="strings"?.095:kind==="flute"?.032:.008));
      const release=Math.min(1,(duration-t)/(kind==="strings"?.22:.12));
      const decay=kind==="pluck"?Math.exp(-2.4*t):kind==="bell"?Math.exp(-2*t):kind==="bass"?Math.exp(-1.3*t):kind==="keys"?(.3+.7*Math.exp(-3.8*t)):1;
      const wave=kind==="pluck"?.81*Math.sin(ph)+.25*Math.sin(2*ph)+.07*Math.sin(3*ph)
        :kind==="bell"?.76*Math.sin(ph)+.21*Math.sin(ph*2.01)+.08*Math.sin(ph*3.99)
        :kind==="bass"?.85*Math.sin(ph)+.16*Math.sin(2*ph)
        :kind==="keys"?.72*Math.sin(ph)+.22*Math.sin(ph*2.001)+.09*Math.sin(ph*3.002)
        :kind==="flute"?.88*Math.sin(ph)+.13*Math.sin(2*ph)+.032*Math.sin(3*ph)
        :kind==="strings"?.53*Math.sin(ph)+.26*Math.sin(ph*1.004)+.17*Math.sin(2*ph)
        :.68*Math.sin(ph)+.16*Math.sin(ph*2)+.12*Math.sin(ph*1.005);
      mix[begin+i]+=amp*wave*attack*Math.max(0,release)*decay;
    }
  }
  const chords=[
    {notes:[60,64,67],bass:48},
    {notes:[59,62,67],bass:43},
    {notes:[60,64,69],bass:45},
    {notes:[60,65,69],bass:41},
    {notes:[60,64,67],bass:48},
    {notes:[59,64,67],bass:40},
    {notes:[60,65,69],bass:41},
    {notes:[59,62,67],bass:43}
  ];
  const melody=[
    [76,null,79,81,79,null,76,74],
    [74,76,79,null,81,79,74,null],
    [72,76,79,null,84,81,79,null],
    [77,null,76,72,74,72,69,null],
    [76,79,84,null,83,81,79,76],
    [79,null,83,81,79,76,74,null],
    [77,79,81,null,84,81,79,77],
    [79,null,76,74,72,null,74,null]
  ];
  let seed=49279;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let bar=0;bar<bars;bar++){
    const base=bar*4*beat,ch=chords[bar];
    for(const midi of ch.notes) tone(midi-12,base,4*beat,.035,"pad");
    for(const midi of ch.notes) tone(midi-12,base,4*beat,.016,"strings");
    for(let j=0;j<2;j++) for(const midi of ch.notes) tone(midi,base+j*2*beat,beat*.85,.030,"keys");
    if(bar%4===3) tone(ch.notes[1]+12,base+2*beat,beat*1.45,.045,"flute");
    for(let j=0;j<8;j++){
      const pos=base+j*beat/2;
      const arp=ch.notes[[0,1,2,1,0,1,2,1][j]]+12;
      tone(arp,pos,beat*.38,.075,"pluck");
      if(j%2===0) tone(ch.bass+(j===6?12:0),pos,beat*.65,.13,"bass");
      if(j%2===1){
        const at=Math.round(pos*rate),n=Math.round(.075*rate);
        for(let k=0;k<n && at+k<count;k++){
          const t=k/rate;
          mix[at+k]+=(random()*2-1)*Math.exp(-t*62)*.023;
        }
      }
      if(j===0||j===4){
        const at=Math.round(pos*rate),n=Math.round(.16*rate);
        for(let k=0;k<n && at+k<count;k++){
          const t=k/rate;
          mix[at+k]+=Math.sin(2*Math.PI*(65*t+48*t*Math.exp(-t*18)))*Math.exp(-t*24)*.065;
        }
      }
      const m=melody[bar][j];
      if(m!==null) {
        const next=melody[bar].slice(j+1).findIndex(v=>v!==null);
        const steps=next<0?8-j:next+1;
        tone(m,pos,Math.min(beat*.5*steps*.85,beat*1.5),.14,"bell");
      }
    }
  }
  const dry=mix.slice();
  for(const [delay,gain] of [[.089,.042],[.173,.033],[.281,.022]]){
    const offset=Math.round(delay*rate);
    for(let i=0;i<count;i++) mix[i]+=dry[(i-offset+count)%count]*gain;
  }
  const pcmBytes=count*2;
  const data=new Uint8Array(44+pcmBytes);
  const dv=new DataView(data.buffer);
  const put=(offset,str)=>{for(let i=0;i<str.length;i++)data[offset+i]=str.charCodeAt(i);};
  put(0,"RIFF");dv.setUint32(4,36+pcmBytes,true);put(8,"WAVE");put(12,"fmt ");
  dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);
  dv.setUint32(24,rate,true);dv.setUint32(28,rate*2,true);dv.setUint16(32,2,true);dv.setUint16(34,16,true);
  put(36,"data");dv.setUint32(40,pcmBytes,true);
  let peak=0;
  for(let i=0;i<count;i++)peak=Math.max(peak,Math.abs(mix[i]));
  const scale=Math.min(1.7,.86/Math.max(peak,.0001));
  for(let i=0;i<count;i++){
    const fade=Math.min(1,i/(rate*.025),(count-1-i)/(rate*.035));
    const x=Math.max(-1,Math.min(1,mix[i]*scale*fade));
    dv.setInt16(44+i*2,Math.round(x*32767),true);
  }
  return data;
}

if (process.argv[1]?.endsWith("generate_title_adventure.mjs")) {
  writeFileSync(new URL("../public/audio/bgm/title_adventure.wav", import.meta.url), Buffer.from(renderTitleAdventure()));
}
