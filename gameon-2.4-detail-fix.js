// GameOn 2.4 compatibility patch: load Game Details from the same public-safe RPC used by Find a Game.
// This avoids direct games-table reads being blocked by RLS for non-organisers.

openGame = async function(id) {
  currentGameId = id;
  show('gameDetail');
  $('detail').innerHTML = '<div class="card empty">Loading game…</div>';

  const q = await sb.rpc('get_open_games');
  if (q.error) {
    $('detail').innerHTML = '<div class="error">' + esc(q.error.message) + '</div>';
    return;
  }

  const g = (q.data || []).find(x => String(x.id) === String(id));
  if (!g) {
    $('detail').innerHTML = '<div class="error">This game is no longer available. It may be full or cancelled.</div>';
    return;
  }

  let claimed = false;
  const u = await getUser();
  if (u) {
    const r = await sb
      .from('join_requests')
      .select('id,status')
      .eq('game_id', id)
      .eq('player_id', u.id)
      .in('status', ['pending', 'accepted']);
    claimed = !r.error && (r.data || []).length > 0;
  }

  const remaining = g.spots_available ?? g.players_needed;

  $('detail').innerHTML = `
    <div class="card">
      <span class="tag">${esc(g.format)}</span>
      <h2>${esc(g.venue)}</h2>
      <div class="muted">${fmtDate(g.game_date)} · ${String(g.kickoff_time).slice(0,5)} · £${esc(g.cost)} per player</div>
      <div class="mapBtn" onclick="openVenueMap('${esc(g.venue)}')">📍 Open map / directions</div>
      <hr style="border:0;border-top:1px solid var(--line);margin:14px 0">
      <div class="row"><b>Players still needed</b><div class="big">${remaining}</div></div>
      ${claimed
        ? '<button class="btn ghost" disabled>REQUEST ALREADY SENT</button>'
        : `<button class="btn green" onclick="joinGame('${g.id}')">I'M IN</button>`}
    </div>`;
};
