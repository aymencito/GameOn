// GameOn 2.6 consolidated frontend patch.
// Replaces the layered 2.5 overrides with one deterministic source of truth.
(function(){
  const style=document.createElement('style');
  style.textContent='.choice.green{color:var(--text)!important}.choice.green h2{color:var(--text)!important}.choice.green .muted{color:#bdc7cc!important}';
  document.head.appendChild(style);

  const futureLocal=g=>{
    if(!g||!g.game_date)return false;
    const t=String(g.kickoff_time||'23:59').slice(0,5);
    return new Date(`${g.game_date}T${t}:00`).getTime()>Date.now();
  };

  findGames=async function(){
    show('find');
    $('openGames').innerHTML='<div class="card empty">Loading games…</div>';
    const q=await sb.rpc('get_open_games');
    if(q.error){$('openGames').innerHTML='<div class="error">'+esc(q.error.message)+'</div>';return}
    openCache=(q.data||[]).filter(futureLocal);
    renderOpenGames();
  };

  const originalRenderOpenGames=renderOpenGames;
  renderOpenGames=function(){
    openCache=(openCache||[]).filter(futureLocal);
    return originalRenderOpenGames();
  };

  openGame=async function(id){
    currentGameId=id;
    show('gameDetail');
    $('detail').innerHTML='<div class="card empty">Loading game…</div>';
    const q=await sb.rpc('get_open_games');
    if(q.error){$('detail').innerHTML='<div class="error">'+esc(q.error.message)+'</div>';return}
    const g=(q.data||[]).find(x=>String(x.id)===String(id));
    if(!g||!futureLocal(g)){
      $('detail').innerHTML='<div class="card empty">This game is no longer available. It may be full, cancelled or already started.</div>';
      return;
    }
    let claimed=false;
    const u=await getUser();
    if(u){
      const r=await sb.rpc('get_my_play_activity');
      claimed=!r.error&&(r.data||[]).some(x=>String(x.game_id)===String(id)&&['pending','accepted'].includes(x.request_status));
    }
    const remaining=g.spots_available??g.players_needed;
    $('detail').innerHTML=`<div class="card"><span class="tag">${esc(g.format)}</span><h2>${esc(g.venue)}</h2><div class="muted">${fmtDate(g.game_date)} · ${String(g.kickoff_time).slice(0,5)} · £${esc(g.cost)} per player</div><div class="mapBtn" onclick="openVenueMap('${esc(g.venue)}')">📍 Open map / directions</div><hr style="border:0;border-top:1px solid var(--line);margin:14px 0"><div class="row"><b>Players still needed</b><div class="big">${remaining}</div></div>${claimed?'<button class="btn ghost" disabled>REQUEST ALREADY SENT</button>':`<button class="btn green" onclick="joinGame('${g.id}')">I'M IN</button>`}</div>`;
  };

  const toPlayRow=r=>({status:r.request_status,created_at:r.request_created_at,games:{id:r.game_id,venue:r.venue,game_date:r.game_date,kickoff_time:r.kickoff_time,format:r.format,cost:r.cost,status:r.game_status,organiser_phone:r.organiser_phone}});

  playCard=function(r,latest=false){
    const g=r.games||{};
    const past=!futureLocal(g)||g.status==='expired';
    const st=past?'expired':(g.status==='cancelled'?'cancelled':r.status);
    const lab=st==='accepted'?"YOU'RE IN":st==='pending'?'WAITING FOR ORGANISER':st==='cancelled'?'GAME CANCELLED':st==='expired'?'GAME FINISHED':'NOT THIS TIME';
    const contact=st==='accepted'&&g.organiser_phone?`<button class="btn whats" onclick="location.href='https://wa.me/${phoneKey(g.organiser_phone)}'">MESSAGE ORGANISER</button>`:'';
    return `<div class="card ${latest?'latest':''}">${latest?'<div class="label">LATEST ACTIVITY</div>':''}<span class="tag ${st}">${lab}</span><h3>${esc(g.venue||'Game')}</h3><div class="muted">${g.game_date?fmtDate(g.game_date):''} · ${String(g.kickoff_time||'').slice(0,5)} · £${esc(g.cost||'')}</div><div class="mapBtn" onclick="openVenueMap('${esc(g.venue||'')}')">📍 Map / directions</div>${contact}</div>`;
  };

  renderPlayTabs=function(){
    const list=(playCache||[]).filter(r=>{
      const g=r.games||{};
      const past=!futureLocal(g)||g.status==='expired'||['cancelled','declined'].includes(r.status)||g.status==='cancelled';
      if(playTab==='waiting')return r.status==='pending'&&!past;
      if(playTab==='upcoming')return r.status==='accepted'&&!past;
      return past;
    });
    $('playList').innerHTML=list.map(r=>playCard(r)).join('')||`<div class="card empty">${playTab==='waiting'?'No requests waiting for organisers.':playTab==='upcoming'?'No confirmed games yet.':'No history yet.'}</div>`;
  };

  openMyPlay=async function(){
    show('myplay');
    const u=await getUser();
    if(!u){$('latestPlay').innerHTML='';$('playList').innerHTML='<div class="card">Browse games without signing in. Sign in only when you join.</div>';return}
    const q=await sb.rpc('get_my_play_activity');
    if(q.error){$('latestPlay').innerHTML='<div class="error">'+esc(q.error.message)+'</div>';$('playList').innerHTML='';return}
    playCache=(q.data||[]).map(toPlayRow);
    const latest=playCache.find(r=>futureLocal(r.games)&&['pending','accepted'].includes(r.status)&&r.games?.status!=='cancelled'&&r.games?.status!=='expired');
    $('latestPlay').innerHTML=latest?playCard(latest,true):'';
    renderPlayTabs();
  };

  openMyGames=async function(){
    show('mygames');
    const u=await getUser();
    if(!u){$('mine').innerHTML='<div class="card">Sign in to manage your shortages.</div>';return}
    const q=await sb.rpc('get_my_organiser_games');
    if(q.error){$('mine').innerHTML='<div class="error">'+esc(q.error.message)+'</div>';return}
    const rows=(q.data||[]).filter(futureLocal);
    $('mine').innerHTML=rows.map(g=>`<div class="card"><div class="row"><div><span class="tag">${esc(g.format)}</span><h3>${esc(g.venue)}</h3><div class="muted">${fmtDate(g.game_date)} · ${String(g.kickoff_time).slice(0,5)}</div></div><div><div class="big">${g.players_needed}</div><div class="muted">needed</div></div></div><div class="actions"><button class="btn ${Number(g.pending_count)>0?'red':'ghost'}" onclick="openRequests('${g.id}')">REQUESTS ${Number(g.pending_count)||0}</button><button class="btn whats" onclick="shareGameObj('${g.id}','${encodeURIComponent(g.venue)}','${g.game_date}','${String(g.kickoff_time).slice(0,5)}','${g.format}',${g.players_needed},${g.cost})">WHATSAPP</button></div><div class="actions" style="margin-top:8px"><button class="btn ghost" onclick="setState('${g.id}','filled')">MARK FILLED</button><button class="btn ghost" onclick="setState('${g.id}','cancelled')">CANCEL</button></div></div>`).join('')||'<div class="card empty">No active shortages.</div>';
  };

  openRequests=async function(id){
    currentGameId=id;
    show('requests');
    $('requestStatus').innerHTML='';
    $('requestsList').innerHTML='<div class="card empty">Loading requests…</div>';
    const q=await sb.rpc('get_pending_requests_for_game_v2',{p_game_id:id});
    if(q.error){$('requestsList').innerHTML='<div class="error">'+esc(q.error.message)+'</div>';return}
    const rows=q.data||[];
    if(!rows.length){$('requestsList').innerHTML='<div class="card empty">No pending player requests.</div>';return}
    $('requestsList').innerHTML=rows.map(r=>{const name=r.player_name||'GameOn player',initials=name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();return `<div class="card"><div class="playerHead"><div class="avatar">${esc(initials)}</div><div><h3 style="margin:0 0 4px">${esc(name)}</h3><div class="muted">⚽ ${esc(r.player_level||'Level not set')}</div><div class="phoneHint">GameOn account · contact shared after acceptance</div></div></div><div class="actions" style="margin-top:14px"><button class="btn whats" onclick="acceptWhats('${r.request_id}','${esc(r.player_phone||'')}','${esc(name)}')">ACCEPT & WHATSAPP</button><button class="btn ghost" onclick="declineReq('${r.request_id}')">DECLINE</button></div></div>`}).join('');
  };

  postShortage=async function(){
    const u=await getUser();
    if(!u)return shortFlow();
    const venue=selectedVenue(),date=$('date').value,time=$('time').value;
    if(!venue||!date||!time){$('postErr').innerHTML='<div class="error">Choose a venue, date and kickoff time.</div>';return}
    if(new Date(`${date}T${time}:00`).getTime()<=Date.now()){$('postErr').innerHTML='<div class="error">Kickoff must be in the future.</div>';return}
    const p=await sb.from('profiles').select('first_name,phone').eq('id',u.id).maybeSingle();
    if(p.error||!p.data?.first_name||!p.data?.phone){pendingAfterAuth='short';return openProfile()}
    const obj={organiser_id:u.id,organiser_name:p.data.first_name,organiser_phone:p.data.phone,venue,game_date:date,kickoff_time:time,format:$('format').value,players_needed:Number($('needed').value),cost:Number($('fee').value),level:'Any',status:'open'};
    const q=await sb.from('games').insert(obj).select('id').single();
    if(q.error){$('postErr').innerHTML='<div class="error">'+esc(q.error.message)+'</div>';return}
    current={...obj,id:q.data.id};
    $('postedCard').innerHTML=`<b>${esc(obj.venue)}</b><div class="muted">${fmtDate(obj.game_date)} · ${obj.kickoff_time} · ${obj.format} · £${obj.cost}</div><div class="big" style="margin-top:10px">${obj.players_needed}</div><div class="muted">players needed</div>`;
    show('posted');
  };

  sendLink=async function(){
    const email=$('email').value.trim();
    if(!email){$('authMsg').innerHTML='<div class="error">Enter your email address.</div>';return}
    const suffix=currentGameId?'?game='+encodeURIComponent(currentGameId):'';
    const q=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname+suffix}});
    $('authMsg').innerHTML=`<div class="${q.error?'error':'ok'}">${esc(q.error?.message||'Check your email for your GameOn sign-in link.')}</div>`;
  };
})();
