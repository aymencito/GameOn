// GameOn 2.5 patch: secure My Play activity + home play-card colour.

(function(){
  const style=document.createElement('style');
  style.textContent=`
    .choice.green{color:var(--text)!important}
    .choice.green h2{color:#eaffee!important}
    .choice.green .muted{color:#b9c7be!important}
  `;
  document.head.appendChild(style);
})();

openMyPlay = async function(){
  show('myplay');
  const u = await getUser();
  if(!u){
    $('latestPlay').innerHTML='';
    $('playList').innerHTML='<div class="card">Browse games without signing in. Sign in only when you join.</div>';
    return;
  }

  const q = await sb.rpc('get_my_play_activity');
  if(q.error){
    $('latestPlay').innerHTML='<div class="error">'+esc(q.error.message)+'</div>';
    $('playList').innerHTML='';
    return;
  }

  playCache=(q.data||[]).map(r=>({
    status:r.request_status,
    created_at:r.request_created_at,
    games:{
      id:r.game_id,
      venue:r.venue,
      game_date:r.game_date,
      kickoff_time:r.kickoff_time,
      format:r.format,
      cost:r.cost,
      status:r.game_status,
      organiser_phone:r.organiser_phone
    }
  }));

  const today=localISO();
  const latest=playCache.find(r=>
    r.games?.game_date>=today &&
    ['pending','accepted'].includes(r.status) &&
    r.games?.status!=='cancelled'
  );

  $('latestPlay').innerHTML=latest?playCard(latest,true):'';
  renderPlayTabs();
};
