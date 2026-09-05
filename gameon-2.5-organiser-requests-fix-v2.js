// GameOn 2.5 organiser requests hard override
(function(){
  window.openRequests = async function(id){
    show('requests');
    $('requestStatus').innerHTML='';
    $('requestsList').innerHTML='<div class="card empty">Loading requests…</div>';

    const q = await sb.rpc('get_pending_requests_for_game_v2',{p_game_id:id});
    if(q.error){
      $('requestsList').innerHTML='<div class="error">'+esc(q.error.message)+'</div>';
      return;
    }

    const rows = q.data || [];
    if(rows.length === 0){
      $('requestsList').innerHTML='<div class="card empty">No pending player requests.</div>';
      return;
    }

    $('requestsList').innerHTML=rows.map(r=>`<div class="card"><div class="playerHead"><div class="avatar">${esc((r.player_name||'?').slice(0,2).toUpperCase())}</div><div><h3 style="margin:0">${esc(r.player_name||'Player')}</h3><div class="muted">${esc(r.player_level||'')}</div></div></div><div class="actions" style="margin-top:14px"><button class="btn green" onclick="acceptWhats('${r.request_id}','${esc(r.player_phone||'')}')">ACCEPT & WHATSAPP</button><button class="btn ghost" onclick="declineReq('${r.request_id}')">DECLINE</button></div></div>`).join('');
  };
})();
