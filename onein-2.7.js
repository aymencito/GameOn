// ONEIN 2.7 brand + UX polish. Runs after the stable GameOn 2.6 patch.
(function(){
  document.title='ONEIN — Find your spot';
  const style=document.createElement('style');
  style.textContent=`
  :root{--green:#73ff8c;--red:#ff5964;--bg:#070b0c;--card:#101719;--line:#223036;--muted:#8e9da4}
  body{background:radial-gradient(circle at 82% -4%,rgba(115,255,140,.14),transparent 28%),linear-gradient(180deg,#070a0b,#090e10)}
  .app{padding-top:22px}.brand{font-style:normal;font-size:31px;letter-spacing:-1.8px}.brand .onein-in{color:var(--green)}
  .hero{font-size:41px;line-height:1.01;margin-top:32px}.hero span{color:var(--green)}
  .choice{min-height:150px;border-radius:24px;transition:transform .15s ease,border-color .15s ease}.choice:active{transform:scale(.985)}
  .choice:after{content:'1';font-weight:950;font-style:italic;font-size:150px;right:3px;top:-35px;opacity:.045}
  .choice.red{background:linear-gradient(145deg,#29171a,#101719)}.choice.green{background:linear-gradient(145deg,#14391e,#101719)}
  .choice h2{font-size:22px;letter-spacing:-.4px}.card,.fieldGroup{border-radius:22px}.btn{border-radius:16px}
  .nav{padding-bottom:max(14px,env(safe-area-inset-bottom));cursor:pointer}.nav div{padding:2px 0}.nav b{font-size:20px}
  .onein-kicker{display:inline-flex;align-items:center;gap:7px;border:1px solid #2b3a40;background:#101719;border-radius:999px;padding:7px 10px;font-size:11px;font-weight:900;letter-spacing:.7px;color:#aebbc0}.onein-dot{width:7px;height:7px;border-radius:50%;background:var(--green);box-shadow:0 0 12px rgba(115,255,140,.7)}
  `;
  document.head.appendChild(style);

  const home=$('home');
  if(home){
    const brand=home.querySelector('.brand'); if(brand)brand.innerHTML='ONE<span class="onein-in">IN</span>';
    const badge=home.querySelector('.muted'); if(badge)badge.innerHTML='<span class="onein-kicker"><span class="onein-dot"></span>GLASGOW · FOOTBALL BETA</span>';
    const hero=home.querySelector('.hero'); if(hero)hero.innerHTML='Someone dropped out?<br><span>Keep the game on.</span>';
    const sub=home.querySelector('.sub'); if(sub)sub.textContent='Your team stays yours. ONEIN finds the missing players before kickoff.';
    const choices=home.querySelectorAll('.choice');
    if(choices[0]){choices[0].querySelector('h2').textContent='I NEED PLAYERS';choices[0].querySelector('.muted').textContent='Fill only the spots your group is missing.'}
    if(choices[1]){choices[1].querySelector('h2').textContent='FIND A SPOT';choices[1].querySelector('.muted').textContent='See nearby games with places open.'}
  }

  const headings={find:'Find a spot',gameDetail:'Spot details',short:'Need players',posted:"You're live",mygames:'My Games',requests:'Player requests'};
  Object.entries(headings).forEach(([id,text])=>{const el=$(id)?.querySelector('h1');if(el)el.textContent=text});
  const myBtn=$('mygames')?.querySelector('.btn.red');if(myBtn)myBtn.textContent='＋ NEED PLAYERS';
  const postBtn=$('short')?.querySelector('.btn.red');if(postBtn)postBtn.textContent='FIND MY PLAYERS';
  const findBtn=$('myplay')?.querySelector('.btn.green');if(findBtn)findBtn.textContent='＋ FIND A SPOT';
  const signedOut=$('signedOut')?.querySelector('.sub');if(signedOut)signedOut.textContent='Sign in with email. No password needed.';

  // Brand every user-facing message without changing the proven 2.6 data flow.
  const oldShareCurrent=shareCurrent;
  shareCurrent=function(){
    if(!current)return oldShareCurrent();
    const url=gameLink(current.id);
    const text=`⚡ ONEIN — ${current.players_needed} SPOT${current.players_needed===1?'':'S'} OPEN\n\n📍 ${current.venue}\n📅 ${fmtDate(current.game_date)}\n🕗 ${current.kickoff_time}\n⚽ ${current.format}\n💷 £${current.cost} per player\n\nClaim a spot: ${url}`;
    location.href='https://wa.me/?text='+encodeURIComponent(text);
  };

  const oldShareGameObj=shareGameObj;
  shareGameObj=function(id,venue,date,time,format,needed,cost){
    try{
      venue=decodeURIComponent(venue);
      const url=gameLink(id);
      const text=`⚡ ONEIN — ${needed} SPOT${Number(needed)===1?'':'S'} OPEN\n\n📍 ${venue}\n📅 ${fmtDate(date)}\n🕗 ${time}\n⚽ ${format}\n💷 £${cost} per player\n\nClaim a spot: ${url}`;
      location.href='https://wa.me/?text='+encodeURIComponent(text);
    }catch(e){return oldShareGameObj(id,venue,date,time,format,needed,cost)}
  };

  // Keep terminology consistent on dynamically rendered 2.6 screens.
  const oldOpenGame=openGame;
  openGame=async function(id){await oldOpenGame(id);const btn=$('detail')?.querySelector('.btn.green');if(btn&&btn.textContent.trim()==="I'M IN")btn.textContent='CLAIM THIS SPOT'};
  const oldFindGames=findGames;
  findGames=async function(){await oldFindGames();document.querySelectorAll('#openGames .btn.green').forEach(b=>b.textContent='VIEW SPOT')};
  const oldRenderOpenGames=renderOpenGames;
  renderOpenGames=function(){const r=oldRenderOpenGames();document.querySelectorAll('#openGames .btn.green').forEach(b=>b.textContent='VIEW SPOT');return r};
})();
