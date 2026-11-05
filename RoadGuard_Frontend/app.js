import {RoadGuardAPI} from './api.js';
const $ = id => document.getElementById(id);
let storedURL; try {storedURL=localStorage.getItem('roadguard-api');} catch {}
let api; try {api=new RoadGuardAPI(storedURL || 'http://127.0.0.1:8000');} catch {api=new RoadGuardAPI();}
let pageOffset=0, reportTotal=0, review=null, detection=null, selectedImage=null, imageVersion=0;
let reportLoadVersion=0, overviewLoadVersion=0;
const pageNames={overview:'Overview',detect:'Detect potholes',reports:'Hazard reports',alerts:'Nearby alerts',settings:'Connection'};
const labels={reported:'Awaiting review',confirmed:'Confirmed',resolved:'Resolved'};
function notify(message,error=false){$('notice').textContent=message;$('notice').className=error?'error':'';$('notice').hidden=false;}
function node(tag,text,className=''){const e=document.createElement(tag);e.textContent=text;e.className=className;return e;}
function pill(status){return node('span',labels[status]||status,'pill '+status);}
function date(value){return new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});}
function locationText(r){return `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`;}
function busy(form,state){for(const b of form.querySelectorAll('button'))b.disabled=state;}
function coords(form){return {latitude:Number(form.elements.latitude.value),longitude:Number(form.elements.longitude.value)};}
async function overview(){
  const token=++overviewLoadVersion;
  try {
    const [all,reported,confirmed,resolved]=await Promise.all([api.list('',5),api.list('reported',1),api.list('confirmed',1),api.list('resolved',1)]);
    if(token!==overviewLoadVersion)return;
    for(const [key,data] of Object.entries({total:all,reported,confirmed,resolved}))$('count-'+key).textContent=data.total;
    const container=$('recent-reports');container.replaceChildren();container.className=all.items.length?'':'empty';
    if(!all.items.length)container.textContent='No reports yet. Analyze an image or add a manual report to get started.';
    for(const r of all.items){const row=node('div','','recent-row'),left=node('div','');left.append(node('b',r.description || 'Pothole observation'),node('p',locationText(r)+' · '+date(r.created_at)));row.append(left,pill(r.status));container.append(row);}
  } catch(e){if(token!==overviewLoadVersion)return;for(const k of ['total','reported','confirmed','resolved'])$('count-'+k).textContent='—';$('recent-reports').replaceChildren(node('p','Reports could not be loaded. Check Connection settings.'));throw e;}
}
async function loadReports(){
  const token=++reportLoadVersion;
  const result=await api.list($('status-filter').value,20,pageOffset);
  if(token!==reportLoadVersion)return;
  reportTotal=result.total;$('report-count').textContent=`${reportTotal} report${reportTotal===1?'':'s'}`;
  const tbody=$('reports-body');tbody.replaceChildren();
  if(!result.items.length){const tr=document.createElement('tr');const td=node('td','No reports match this filter.');td.colSpan=5;tr.append(td);tbody.append(tr);}
  for(const r of result.items){const tr=document.createElement('tr');const desc=node('td','','report-description');desc.append(node('b',r.description||'Pothole observation'),node('small',`${r.source} · ${r.id.slice(0,8)}`));
    const status=node('td','');status.append(pill(r.status));const actions=node('td',''),wrap=node('div','','review-actions');
    for(const action of (r.status==='reported'?['confirmed','resolved']:r.status==='confirmed'?['resolved']:[])){
      const b=node('button',action==='confirmed'?'Confirm':'Resolve','button secondary');b.type='button';b.addEventListener('click',()=>openReview(r,action));wrap.append(b);
    }
    if(r.status==='resolved')wrap.append(node('span','Closed','hint'));actions.append(wrap);
    if(r.resolution_note)desc.append(node('small','Review: '+r.resolution_note));
    tr.append(desc,node('td',locationText(r)),status,node('td',date(r.created_at)),actions);tbody.append(tr);
  }
  $('previous-page').disabled=pageOffset===0;$('next-page').disabled=pageOffset+20>=reportTotal;$('page-number').textContent=`Page ${Math.floor(pageOffset/20)+1}`;
}
async function connection(){
  try {const h=await api.health();await api.list('',1);$('connection-badge').className='status online';$('connection-badge').textContent='● Backend connected';$('connection-detail').textContent=`Database: ${h.database}. Model file: ${h.model_file_present?'found':'not found — copy your .pt file to backend/models'}. File presence does not verify GPU inference.`;return true;}
  catch(e){$('connection-badge').className='status offline';$('connection-badge').textContent='○ Check connection';$('connection-detail').textContent=e.message;notify(e.message,true);return false;}
}
function route(){const page=Object.hasOwn(pageNames,location.hash.slice(1))?location.hash.slice(1):'overview';for(const id of Object.keys(pageNames))$(id).hidden=id!==page;for(const a of document.querySelectorAll('nav a'))a.classList.toggle('active',a.dataset.page===page);$('breadcrumb').textContent=pageNames[page];if(page==='overview')overview().catch(e=>notify(e.message,true));if(page==='reports')loadReports().catch(e=>notify(e.message,true));}
window.addEventListener('hashchange',route);
$('connection-badge').onclick=()=>location.hash='settings';
$('api-url').value=api.base;
$('settings-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;busy(form,true);try{api=new RoadGuardAPI($('api-url').value.trim(),$('api-key').value.trim());try{localStorage.setItem('roadguard-api',api.base);}catch{}if(await connection()){notify('Backend connected. Your database is ready.');await overview();}}catch(err){notify(err.message,true);}finally{busy(form,false);}});
$('confidence').oninput=()=>{$('confidence-value').textContent=Number($('confidence').value).toFixed(2);};
function draw(image, boxes=[]){const canvas=$('preview-canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const size=Math.max(13,Math.round(image.width/55));ctx.font=`bold ${size}px Arial`;ctx.lineWidth=Math.max(2,image.width/350);for(const b of boxes){const [x1,y1,x2,y2]=b.xyxy;ctx.strokeStyle='#daf579';ctx.strokeRect(x1,y1,x2-x1,y2-y1);const text=`${b.label} ${b.confidence.toFixed(2)}`;const w=ctx.measureText(text).width+12;const x=Math.max(0,Math.min(x1,image.width-w));const y=Math.max(size+8,y1);ctx.fillStyle='#daf579';ctx.fillRect(x,y-size-8,w,size+8);ctx.fillStyle='#153f34';ctx.fillText(text,x+6,y-5);}canvas.hidden=false;$('preview-placeholder').hidden=true;}
$('image-file').addEventListener('change',async()=>{
  const version=++imageVersion;detection=null;$('detection-report-fields').disabled=true;$('prediction-summary').replaceChildren();selectedImage?.close();selectedImage=null;$('preview-canvas').hidden=true;$('preview-placeholder').hidden=false;
  const f=$('image-file').files[0];if(!f)return;
  try {if(f.size>10*1024*1024)throw new Error('Choose an image smaller than 10 MiB.');if(!['image/jpeg','image/png'].includes(f.type))throw new Error('Choose a JPEG or PNG image.');const bitmap=await createImageBitmap(f,{imageOrientation:'from-image'});if(version!==imageVersion){bitmap.close();return;}if(bitmap.width*bitmap.height>20_000_000){bitmap.close();throw new Error('Choose an image no larger than 20 megapixels.');}selectedImage=bitmap;draw(bitmap);}catch(err){$('image-file').value='';notify(err.message,true);}
});
$('detect-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!selectedImage){notify('Select a valid image first.',true);return;}const form=e.currentTarget;const version=imageVersion;busy(form,true);$('image-file').disabled=true;$('confidence').disabled=true;$('analyze-button').textContent='Analyzing…';detection=null;$('detection-report-fields').disabled=true;
  try {const result=await api.detect($('image-file').files[0],Number($('confidence').value));if(version!==imageVersion)return;detection=result;draw(selectedImage,result.boxes);const summary=$('prediction-summary');summary.replaceChildren(node('p',`${result.boxes.length} prediction${result.boxes.length===1?'':'s'} · Review before reporting`));const list=node('ul','','prediction-list');for(const box of result.boxes)list.append(node('li',`${box.label} · confidence ${box.confidence.toFixed(2)}`));summary.append(list);$('detection-report-fields').disabled=!result.boxes.some(b=>b.label.toLowerCase()==='pothole');notify(result.boxes.length?'Analysis complete. Review the boxes and supply a location.':'No predictions at this threshold. This does not prove the road is clear.');}
  catch(err){notify(err.message,true);}finally{busy(form,false);$('image-file').disabled=false;$('confidence').disabled=false;$('analyze-button').textContent='Analyze image';}
});
for(const [id,source] of [['manual-report-form','manual'],['detection-report-form','model']])$(id).addEventListener('submit',async e=>{
  e.preventDefault();const form=e.currentTarget;if(source==='model'&&!detection)return;busy(form,true);
  try {const body={...coords(form),description:form.elements.description.value.trim(),source};if(source==='model')body.detection_id=detection.id;const saved=await api.report(body);form.reset();if(source==='model'){$('detection-report-fields').disabled=true;detection=null;}pageOffset=0;notify(`Report ${saved.id.slice(0,8)} saved. It is awaiting review.`);location.hash='reports';if(!$('reports').hidden)await loadReports();}
  catch(err){notify(err.message,true);}finally{busy(form,false);}
});
for(const b of document.querySelectorAll('.location-button'))b.addEventListener('click',()=>{
  if(!navigator.geolocation){notify('Device location is unavailable. Enter coordinates manually.',true);return;}
  b.disabled=true;navigator.geolocation.getCurrentPosition(pos=>{const form=b.closest('form');form.elements.latitude.value=pos.coords.latitude;form.elements.longitude.value=pos.coords.longitude;b.disabled=false;notify(`Device location filled (reported accuracy ±${Math.round(pos.coords.accuracy)} m). Verify the report location.`);},err=>{b.disabled=false;notify('Location unavailable or permission denied. Enter coordinates manually.',true);},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
});
$('status-filter').onchange=()=>{pageOffset=0;loadReports().catch(e=>notify(e.message,true));};
$('refresh-reports').onclick=()=>loadReports().catch(e=>notify(e.message,true));
$('previous-page').onclick=()=>{pageOffset=Math.max(0,pageOffset-20);loadReports().catch(e=>notify(e.message,true));};
$('next-page').onclick=()=>{pageOffset+=20;loadReports().catch(e=>notify(e.message,true));};
function openReview(r,status){review={id:r.id,status};$('review-title').textContent=status==='confirmed'?'Confirm this hazard':'Resolve this report';$('review-description').textContent=status==='confirmed'?'Confirm only after verifying the reported hazard. This will include it in nearby alerts.':'Resolve only after independent verification. A missed model prediction alone is not evidence that a pothole was repaired.';$('review-note').value='';$('review-dialog').showModal();}
$('cancel-review').onclick=()=>$('review-dialog').close();
$('review-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;const note=$('review-note').value.trim();if(note.length<5){notify('Please enter a meaningful verification note.',true);return;}busy(form,true);try{await api.status(review.id,review.status,note);$('review-dialog').close();notify('Report status updated.');await loadReports();}catch(err){notify(err.message,true);}finally{busy(form,false);}});
$('alerts-form').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget;busy(form,true);const container=$('alert-results');container.replaceChildren(node('p','Checking…'));try{const {latitude,longitude}=coords(form);const result=await api.nearby(latitude,longitude,Number(form.elements.radius_m.value));container.replaceChildren();container.className=result.items.length?'':'empty';if(!result.items.length)container.textContent='No confirmed reports within this radius. This does not guarantee the road is clear.';for(const r of result.items){const card=node('div','','alert-card');card.append(node('span',`${r.distance_m} m`,'distance'),node('h3',r.description||'Confirmed pothole'),node('p',locationText(r)));container.append(card);}notify(`Proximity check complete: ${result.items.length} confirmed report(s).`);}catch(err){container.textContent='Could not load nearby alerts.';notify(err.message,true);}finally{busy(form,false);}});
route();connection();
