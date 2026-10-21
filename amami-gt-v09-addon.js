
// v0.9: tide charts and compressed trip photos
let tideRecord=null,photoRecord={lure:null,seat:null},tideSeq=0;
function tideLocation(){
 const p=validPoint(selectedTripPoint)?selectedTripPoint:{lat:28.400,lng:129.495};
 return {lat:p.lat,lng:p.lng,label:validPoint(selectedTripPoint)?'選択地点付近':'名瀬周辺（参考地点）'};
}
function tideKey(date,p){return date+'|'+p.lat.toFixed(3)+'|'+p.lng.toFixed(3);}
function makeTideGraph(root,data){
 root.replaceChildren();
 if(!Array.isArray(data?.values)||data.values.length<2)return;
 const vals=data.values.map(Number);
 if(vals.some(v=>!Number.isFinite(v)))return;
 const ns='http://www.w3.org/2000/svg';
 const node=(tag,attrs,txt)=>{
  const e=document.createElementNS(ns,tag);
  for(const [k,v] of Object.entries(attrs||{}))e.setAttribute(k,String(v));
  if(txt!==undefined)e.textContent=txt;
  return e;
 };
 const svg=node('svg',{viewBox:'0 0 360 180',role:'img','aria-label':'1日の予測潮位の曲線'});
 const low=Math.min(...vals),high=Math.max(...vals),pad=Math.max(.04,(high-low)*.15);
 const a=low-pad,b=high+pad,px=i=>43+i*300/(vals.length-1),py=v=>13+(b-v)*134/(b-a);
 for(let j=0;j<4;j++){
  const val=a+(b-a)*j/3,y=py(val);
  svg.appendChild(node('line',{x1:43,x2:343,y1:y,y2:y,stroke:'#4b7083','stroke-width':.7}));
  svg.appendChild(node('text',{x:4,y:y+4,fill:'#d1e4ee','font-size':9},val.toFixed(1)+'m'));
 }
 for(const h of [0,6,12,18,23]){
  const x=px(Math.round(h*(vals.length-1)/23));
  svg.appendChild(node('text',{x,y:170,fill:'#d1e4ee','font-size':10,'text-anchor':'middle'},String(h).padStart(2,'0')+'時'));
 }
 svg.appendChild(node('polyline',{points:vals.map((v,i)=>px(i).toFixed(1)+','+py(v).toFixed(1)).join(' '),fill:'none',stroke:'#59e2d1','stroke-width':2.5}));
 for(const peak of [...(data.highs||[]),...(data.lows||[])]){
  const i=(data.times||[]).indexOf(peak.time);
  if(i>=0)svg.appendChild(node('circle',{cx:px(i),cy:py(Number(peak.height)),r:3.7,fill:(data.highs||[]).includes(peak)?'#ffcc8d':'#9bc4ff'}));
 }
 root.appendChild(svg);
}
function tidePeaks(data){
 return [...(data.highs||[]).map(p=>({...p,label:'🔺 満潮頃'})),...(data.lows||[]).map(p=>({...p,label:'🔻 干潮頃'}))].sort((a,b)=>String(a.time).localeCompare(String(b.time)));
}
function displayTide(data,message){
 $('tide-status').textContent=message||(data?'✅ '+data.date+'・'+data.site+'の予測（参考）':'潮汐は未取得');
 $('tide-peaks').replaceChildren();$('tide-chart').replaceChildren();$('tide-chart').hidden=!data;
 if(!data)return;
 for(const p of tidePeaks(data)){
  const s=document.createElement('span');
  s.textContent=p.label+' '+p.time+'（'+Number(p.height).toFixed(2)+'m）';
  $('tide-peaks').appendChild(s);
 }
 if(!tidePeaks(data).length)$('tide-peaks').textContent='この日の山・谷は判定できなかったため、グラフを確認してね。';
 makeTideGraph($('tide-chart'),data);
}
async function loadTripTide(force=false){
 const date=$('date').value;
 if(!date){displayTide(null,'先に釣行日を選んでね');return;}
 const loc=tideLocation(),key=tideKey(date,loc);
 if(!force&&tideRecord&&tideRecord.key===key){displayTide(tideRecord);return;}
 const token=++tideSeq;
 displayTide(null,'🌊 '+date+'の予測潮位を取得中…');
 try{
  const url=new URL('https://marine-api.open-meteo.com/v1/marine');
  const params={latitude:loc.lat,longitude:loc.lng,hourly:'sea_level_height_msl',start_date:date,end_date:date,timezone:'Asia/Tokyo',cell_selection:'sea'};
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
  const resp=await fetch(url.toString());
  if(!resp.ok)throw Error('HTTP '+resp.status);
  const obj=await resp.json();
  if(obj.error)throw Error(obj.reason||'データがありません');
  const rawT=obj.hourly?.time||[],rawV=obj.hourly?.sea_level_height_msl||[];
  const times=[],values=[];
  for(let i=0;i<rawT.length;i++){
   if(typeof rawT[i]==='string'&&rawT[i].startsWith(date)&&rawV[i]!=null&&Number.isFinite(Number(rawV[i]))){
    times.push(rawT[i].slice(11,16));values.push(Number(rawV[i]));
   }
  }
  if(values.length<12)throw Error('予測値が不足しています');
  const highs=[],lows=[];
  for(let i=1;i<values.length-1;i++){
   if(values[i]>values[i-1]&&values[i]>=values[i+1])highs.push({time:times[i],height:values[i]});
   if(values[i]<values[i-1]&&values[i]<=values[i+1])lows.push({time:times[i],height:values[i]});
  }
  if(token!==tideSeq||date!==$('date').value)return;
  tideRecord={key,date,site:loc.label,source:'Open-Meteo Marine (MSL model)',times,values,highs,lows};
  displayTide(tideRecord);
 }catch(e){
  if(token!==tideSeq)return;
  tideRecord=null;
  displayTide(null,'⚠️ 予測データを取得できないぞ（通信・日付・提供範囲を確認）。あとで「潮汐を取得」を押してね。');
 }
}
function displayTripPhotos(){
 for(const kind of ['lure','seat']){
  const photo=photoRecord[kind],img=$(kind+'-preview');
  img.hidden=!photo;$(kind+'-remove').hidden=!photo;
  if(photo)img.src=photo;else img.removeAttribute('src');
  $(kind+'-photo-status').textContent=photo?'✅ 1枚準備済み。釣行を保存するとクラウドに反映されるぞ。':'撮影するか、スマホにある写真を選んでね。';
 }
}
async function compressPhoto(file){
 if(!file||!file.type.startsWith('image/'))throw Error('写真を選んでね');
 if(file.size>15*1024*1024)throw Error('元の写真は15MB以下でお願い');
 const url=URL.createObjectURL(file);
 let img;
 try{
  img=await new Promise((resolve,reject)=>{
   const x=new Image();x.onload=()=>resolve(x);x.onerror=()=>reject(Error('読み込めない画像形式だ'));x.src=url;
  });
 }finally{URL.revokeObjectURL(url);}
 if(!img.naturalWidth||!img.naturalHeight)throw Error('画像のサイズを読み取れなかった');
 for(const edge of [1000,850,700,560]){
  const scale=Math.min(1,edge/Math.max(img.naturalWidth,img.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('変換できなかった');
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  for(const q of [.8,.65,.5,.4]){
   const out=canvas.toDataURL('image/jpeg',q);
   if(out.startsWith('data:image/jpeg;base64,')&&out.length<=185000)return out;
  }
 }
 throw Error('容量を抑えられない写真だった。別の写真を選んでね');
}
for(const kind of ['lure','seat']){
 $(kind+'-photo-input').addEventListener('change',async e=>{
  const f=e.target.files?.[0];if(!f)return;
  $(kind+'-photo-status').textContent='📷 写真を圧縮中…';
  try{photoRecord[kind]=await compressPhoto(f);displayTripPhotos();}
  catch(error){displayTripPhotos();alert('写真を追加できなかった：'+error.message);}
  finally{e.target.value='';}
 });
 $(kind+'-remove').onclick=()=>{photoRecord[kind]=null;displayTripPhotos();};
}
function resetTripExtras(){
 tideSeq++;tideRecord=null;photoRecord={lure:null,seat:null};
 displayTide(null,'詳細を開くと当日の潮汐予測を取得するぞ。');displayTripPhotos();
}
function restoreTripExtras(r){
 tideSeq++;
 tideRecord=r.tideAuto?.date===$('date').value?r.tideAuto:null;
 const v=r.media||{};
 photoRecord={
  lure:typeof v.lure==='string'&&v.lure.startsWith('data:image/jpeg;base64,')?v.lure:null,
  seat:typeof v.seat==='string'&&v.seat.startsWith('data:image/jpeg;base64,')?v.seat:null
 };
 displayTide(tideRecord,tideRecord?null:'詳細を開くと潮汐を取得するぞ。');displayTripPhotos();
}
$('tide-fetch').onclick=()=>loadTripTide(true);
$('trip-details').addEventListener('toggle',()=>{if($('trip-details').open)loadTripTide();});
$('date').addEventListener('change',()=>{
 tideSeq++;tideRecord=null;displayTide(null,'日付が変わったので予測を更新するぞ。');
 if($('trip-details').open)loadTripTide();
});
function showSavedTripExtras(box,r){
 if(r.tideAuto&&Array.isArray(r.tideAuto.values)){
  const panel=document.createElement('details');panel.className='saved-details';
  const head=document.createElement('summary');head.textContent='🌊 保存した干満予測とグラフ';
  const note=document.createElement('p');note.textContent=(r.tideAuto.date||'')+' / '+(r.tideAuto.site||'推算地点')+'（モデル予測・参考）';
  const times=document.createElement('p');times.textContent=tidePeaks(r.tideAuto).map(p=>p.label+' '+p.time).join(' / ');
  const chart=document.createElement('div');chart.className='tide-chart';makeTideGraph(chart,r.tideAuto);
  panel.append(head,note,times,chart);box.appendChild(panel);
 }
 const photos=[['lure','🎣 使用ルアー'],['seat','🏝️ 釣り座']].filter(([key])=>typeof r.media?.[key]==='string'&&r.media[key].startsWith('data:image/jpeg;base64,'));
 if(photos.length){
  const panel=document.createElement('details');panel.className='saved-details';
  const head=document.createElement('summary');head.textContent='📷 保存写真（'+photos.length+'枚）';
  const row=document.createElement('div');row.className='saved-media';
  for(const [key,label] of photos){
   const figure=document.createElement('figure'),img=document.createElement('img'),cap=document.createElement('figcaption');
   img.src=r.media[key];img.alt=label;img.loading='lazy';cap.textContent=label;
   figure.append(img,cap);row.appendChild(figure);
  }
  panel.append(head,row);box.appendChild(panel);
 }
}
