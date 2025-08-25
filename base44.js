export async function sendMetric(type, payload){
  const BASE44_ENDPOINT = (window.GUARDAI_API || "/api");
  try{
    await fetch(`${BASE44_ENDPOINT}/metrics`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type,payload,at:Date.now()})});
  }catch(e){console.warn("Metric send failed",e);}
}