import { sendMetric } from './base44.js';
let landmarker=null;
export async function initPose(){
  const vision=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm');
  landmarker=await PoseLandmarker.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.5,minPosePresenceConfidence:.5,minTrackingConfidence:.5}); return landmarker;
}
export function evaluateRules(lm){const IDX={NOSE:0,LS:11,RS:12,LE:13,RE:14,LH:23,RH:24};const L=i=>lm[i];const tips=[],good=[];const nose=L(IDX.NOSE),ls=L(IDX.LS),rs=L(IDX.RS),le=L(IDX.LE),re=L(IDX.RE),lh=L(IDX.LH),rh=L(IDX.RH);
 if(nose&&ls&&rs){const shoulderY=(ls.y+rs.y)/2; if(nose.y-0.10>shoulderY) tips.push("להוריד סנטר"); else if(nose.y+0.03<shoulderY) tips.push("להרים מעט את הסנטר"); else good.push("ראש: תקין");}
 if(le&&re&&lh&&rh){const torsoX=(lh.x+rh.x)/2; const spread=Math.max(Math.abs(le.x-torsoX),Math.abs(re.x-torsoX)); if(spread>0.15) tips.push("לקרב מרפקים לגוף"); else good.push("מרפקים: תקין");}
 return {tips,good};}
export function drawSkeleton(ctx,canvas,lm){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.lineWidth=3;ctx.strokeStyle='#14b8a6';ctx.fillStyle='#14b8a6';const pairs=[[11,13],[13,15],[12,14],[14,16],[11,12],[23,24],[11,23],[12,24]];
 for(const p of lm){if(!p) continue; ctx.beginPath(); ctx.arc(p.x*canvas.width,p.y*canvas.height,5,0,Math.PI*2); ctx.fill();}
 for(const [a,b] of pairs){const A=lm[a],B=lm[b]; if(!A||!B) continue; ctx.beginPath(); ctx.moveTo(A.x*canvas.width,A.y*canvas.height); ctx.lineTo(B.x*canvas.width,B.y*canvas.height); ctx.stroke();}}
export async function startTraining($wrap,onFeedback){
  const video=$wrap.querySelector('video'); const canvas=$wrap.querySelector('canvas'); const ctx=canvas.getContext('2d');
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false}); video.srcObject=stream; await video.play();
  function resize(){const r=$wrap.getBoundingClientRect(); canvas.width=r.width*devicePixelRatio; canvas.height=r.height*devicePixelRatio; ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);} resize(); addEventListener('resize',resize);
  if(!landmarker) await initPose(); let running=true; let last=0; let correctStanceMs=0;
  async function loop(ts){ if(!running) return; requestAnimationFrame(loop); if(!video.videoWidth) return; const now=performance.now(); if(now-last<33) return; last=now;
    const res=landmarker.detectForVideo(video,now); if(res&&res.landmarks&&res.landmarks[0]){const lm=res.landmarks[0]; drawSkeleton(ctx,canvas,lm); const fb=evaluateRules(lm); onFeedback(fb); if(fb.tips.length===0){ correctStanceMs+=(now-last);} } }
  requestAnimationFrame(loop);
  return ()=>{ running=false; try{stream.getTracks().forEach(t=>t.stop());}catch(e){} sendMetric('session_end',{correctStanceMs}); };
}