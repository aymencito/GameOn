// GameOn 2.6 consolidated frontend patch.
// Replaces the layered 2.5 overrides with one deterministic source of truth.
(function(){
  let organiserGameCache=[];
  let pendingRequestCache=[];

  const missingRpc=error=>/function|schema cache|could not find/i.test(String(error?.message||''));
  const topNavigate=url=>{try{window.top.location.href=url}catch(_error){window.open(url,'_blank')}};

  if(!document.documentElement.dataset.gameon26SafeActions){
    document.documentElement.dataset.gameon26SafeActions='1';
    document.addEventListener('click',event=>{
      const target=event.target.closest('[data-map-venue],[data-open-game],[data-request-game],[data-share-game],[data-accept-request],[data-decline-request],[data-whatsapp-phone]');
      if(!target)return;
      if(target.dataset.mapVenue!==undefined)return openVenueMap(target.dataset.mapVenue);
      if(target.dataset.openGame)return openGame(target.dataset.openGame);
      if(target.dataset.requestGame)return joinGame(target.dataset.requestGame);
      if(target.dataset.shareGame){
        const g=organiserGameCache.find(row=>String(row.id)===String(target.dataset.shareGame));
        if(g){current={...g};shareCurrent()}
        return;
      }
      if(target.dataset.acceptRequest){
        const r=pendingRequestCache.find(row=>String(row.request_id)===String(target.dataset.acceptRequest))||{};
        return acceptWhats(target.dataset.acceptRequest,r.player_phone||'',r.player_name||'ONEIN player');
      }
      if(target.dataset.declineRequest)return declineReq(target.dataset.declineRequest);
      if(target.dataset.whatsappPhone)return topNavigate('https://wa.me/'+phoneKey(target.dataset.whatsappPhone));
    });
  }

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

  renderOpenGames=function(){
    openCache=(openCache||[]).filter(futureLocal);
    const today=localISO(),week=new Date();
    week.setDate(week.getDate()+7);
    const end=localISO(week),fv=$('findVenue').value,manual=$('findVenueOther').value.toLowerCase().trim();
    const list=openCache.filter(g=>{
      const venue=String(g.venue||'');
      const venueOk=fv==='all'||(fv==='other'?(manual?venue.toLowerCase().includes(manual):true):venue===fv);
      const dateOk=gameFilter==='all'||(gameFilter==='today'?g.game_date===today:g.game_date>=today&&g.game_date<=end);
      return venueOk&&dateOk;
    });
    $('openGames').innerHTML=list.map(g=>`<div class="card"><div class="row"><div><span class="tag">${esc(g.format)}</span><h3>${esc(g.venue)}</h3><div class="muted">${fmtDate(g.game_date)} · ${String(g.kickoff_time).slice(0,5)} · £${esc(g.cost)} per player</div><div class="mapBtn" data-map-venue="${esc(g.venue)}">📍 Map / directions</div></div><div><div class="big">${g.spots_available??g.players_needed}</div><div class="muted">needed</div></div></div><button class="btn green" data-open-game="${esc(g.id)}">VIEW & JOIN</button></div>`).join('')||'<div class="card empty">No games match this venue and date.</div>';
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
    $('detail').innerHTML=`<div class="card"><span class="tag">${esc(g.format)}</span><h2>${esc(g.venue)}</h2><div class="muted">${fmtDate(g.game_date)} · ${String(g.kickoff_time).slice(0,5)} · £${esc(g.cost)} per player</div><div class="mapBtn" data-map-venue="${esc(g.venue)}">📍 Open map / directions</div><hr style="border:0;border-top:1px solid var(--line);margin:14px 0"><div class="row"><b>Players still needed</b><div class="big">${remaining}</div></div>${claimed?'<button class="btn ghost" disabled>REQUEST ALREADY SENT</button>':`<button class="btn green" data-request-game="${esc(g.id)}">I'M IN</button>`}</div>`;
  };

  const toPlayRow=r=>({status:r.request_status,created_at:r.request_created_at,games:{id:r.game_id,venue:r.venue,game_date:r.game_date,kickoff_time:r.kickoff_time,format:r.format,cost:r.cost,status:r.game_status,organiser_phone:r.organiser_phone}});

  playCard=function(r,latest=false){
    const g=r.games||{};
    const past=!futureLocal(g)||g.status==='expired';
    const st=past?'expired':(g.status==='cancelled'?'cancelled':r.status);
    const lab=st==='accepted'?"YOU'RE IN":st==='pending'?'WAITING FOR ORGANISER':st==='cancelled'?'GAME CANCELLED':st==='expired'?'GAME FINISHED':'NOT THIS TIME';
    const contact=st==='accepted'&&g.organiser_phone?`<button class="btn whats" data-whatsapp-phone="${esc(g.organiser_phone)}">MESSAGE ORGANISER</button>`:'';
    return `<div class="card ${latest?'latest':''}">${latest?'<div class="label">LATEST ACTIVITY</div>':''}<span class="tag ${st}">${lab}</span><h3>${esc(g.venue||'Game')}</h3><div class="muted">${g.game_date?fmtDate(g.game_date):''} · ${String(g.kickoff_time||'').slice(0,5)} · £${esc(g.cost||'')}</div><div class="mapBtn" data-map-venue="${esc(g.venue||'')}">📍 Map / directions</div>${contact}</div>`;
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
    organiserGameCache=(q.data||[]).filter(futureLocal);
    $('mine').innerHTML=organiserGameCache.map(g=>`<div class="card"><div class="row"><div><span class="tag">${esc(g.format)}</span><h3>${esc(g.venue)}</h3><div class="muted">${fmtDate(g.game_date)} · ${String(g.kickoff_time).slice(0,5)}</div></div><div><div class="big">${g.players_needed}</div><div class="muted">needed</div></div></div><div class="actions"><button class="btn ${Number(g.pending_count)>0?'red':'ghost'}" onclick="openRequests('${g.id}')">REQUESTS ${Number(g.pending_count)||0}</button><button class="btn whats" data-share-game="${esc(g.id)}">WHATSAPP</button></div><div class="actions" style="margin-top:8px"><button class="btn ghost" onclick="setState('${g.id}','filled')">MARK FILLED</button><button class="btn ghost" onclick="setState('${g.id}','cancelled')">CANCEL</button></div></div>`).join('')||'<div class="card empty">No active shortages.</div>';
  };

  openRequests=async function(id){
    currentGameId=id;
    show('requests');
    $('requestStatus').innerHTML='';
    $('requestsList').innerHTML='<div class="card empty">Loading requests…</div>';
    let q=await sb.rpc('get_pending_requests_for_game_v3',{p_game_id:id});
    if(q.error&&missingRpc(q.error))q=await sb.rpc('get_pending_requests_for_game_v2',{p_game_id:id});
    if(q.error){$('requestsList').innerHTML='<div class="error">'+esc(q.error.message)+'</div>';return}
    pendingRequestCache=q.data||[];
    if(!pendingRequestCache.length){$('requestsList').innerHTML='<div class="card empty">No pending player requests.</div>';return}
    $('requestsList').innerHTML=pendingRequestCache.map(r=>{const name=r.player_name||'GameOn player',initials=name.split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase();return `<div class="card"><div class="playerHead"><div class="avatar">${esc(initials)}</div><div><h3 style="margin:0 0 4px">${esc(name)}</h3><div class="muted">⚽ ${esc(r.player_level||'Level not set')}</div><div class="phoneHint">GameOn account · contact shared after acceptance</div></div></div><div class="actions" style="margin-top:14px"><button class="btn whats" data-accept-request="${esc(r.request_id)}">ACCEPT & WHATSAPP</button><button class="btn ghost" data-decline-request="${esc(r.request_id)}">DECLINE</button></div></div>`}).join('');
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
    let q=await sb.rpc('create_game_secure',{
      p_venue:venue,p_game_date:date,p_kickoff_time:time,p_format:obj.format,
      p_players_needed:obj.players_needed,p_cost:obj.cost,p_level:obj.level
    });
    if(q.error&&missingRpc(q.error))q=await sb.from('games').insert(obj).select('id').single();
    if(q.error){$('postErr').innerHTML='<div class="error">'+esc(q.error.message)+'</div>';return}
    current={...obj,id:typeof q.data==='string'?q.data:q.data.id};
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
