// ONEIN beta launch hardening. Loaded after gameon-2.6.js.
(function(){
  // The magic-link lands on the outer v2-6 page while the app runs inside an
  // iframe. Restore the Supabase session explicitly before any screen checks
  // authentication, then remove credentials from the address bar.
  const restoreOneinSession=(async()=>{
    try{
      const topUrl=new URL(window.top.location.href);
      const hash=new URLSearchParams(topUrl.hash.replace(/^#/,''));
      const accessToken=hash.get('access_token');
      const refreshToken=hash.get('refresh_token');
      if(accessToken&&refreshToken){
        const result=await sb.auth.setSession({access_token:accessToken,refresh_token:refreshToken});
        if(result.error)throw result.error;
        window.top.history.replaceState(null,'',topUrl.pathname+topUrl.search);
      }
      return (await sb.auth.getSession()).data.session?.user||null;
    }catch(error){
      console.error('ONEIN session restoration failed',error);
      return null;
    }
  })();

  const baseGetUser=getUser;
  getUser=async function(){
    await restoreOneinSession;
    const session=await sb.auth.getSession();
    if(session.data.session?.user)return session.data.session.user;
    return baseGetUser();
  };

  // Keep every account surface in sync when Supabase refreshes or clears a
  // session. This prevents the organiser form and Profile disagreeing.
  sb.auth.onAuthStateChange((_event,session)=>{
    if($('profile')?.classList.contains('active'))openProfile();
    if(!session&&$('short')?.classList.contains('active'))openProfile();
  });

  // Surface unexpected save failures and prevent double submissions. The core
  // flow still owns validation and the successful "You're live" state.
  const basePostShortage=postShortage;
  postShortage=async function(){
    await restoreOneinSession;
    const button=$('short')?.querySelector('.btn.red');
    if(button?.disabled)return;
    if(button){button.disabled=true;button.textContent='POSTING…'}
    $('postErr').innerHTML='';
    try{
      await basePostShortage();
    }catch(error){
      console.error('ONEIN game creation failed',error);
      $('postErr').innerHTML='<div class="error">We could not publish this game. Please try again.</div>';
    }finally{
      if(button){button.disabled=false;button.textContent='FIND MY PLAYERS'}
    }
  };

  const waNumber=(p)=>{let n=String(p||'').replace(/\D/g,'');if(n.startsWith('00'))n=n.slice(2);if(n.startsWith('0'))n='44'+n.slice(1);return n};
  const openExternal=(url)=>{try{window.top.location.href=url}catch(e){window.open(url,'_blank')}};

  // WhatsApp must escape the iframe. UK 07 numbers are normalised to 447.
  acceptWhats=async function(id,p,n){
    const q=await sb.rpc('organiser_decide_request',{p_request_id:id,p_decision:'accepted'});
    if(q.error){alert(q.error.message);return}
    const phone=waNumber(p);
    if(phone)openExternal('https://wa.me/'+phone+'?text='+encodeURIComponent(`Hi ${n}, you're in ⚽ See you at the game! — ONEIN`));
    else alert('Player accepted. They have no WhatsApp/mobile number saved in ONEIN.');
  };

  const basePlayCard=playCard;
  playCard=function(r,latest=false){
    let html=basePlayCard(r,latest);
    const phone=waNumber(r?.games?.organiser_phone);
    if(phone) html=html.replace(/onclick="location\.href='https:\/\/wa\.me\/[^']*'"/g,`onclick="window.top.location.href='https://wa.me/${phone}'"`);
    return html;
  };

  const baseOpenRequests=openRequests;
  openRequests=async function(id){await baseOpenRequests(id);document.querySelectorAll('.phoneHint').forEach(x=>x.textContent='ONEIN player · contact shared after acceptance')};

  const baseOpenGame=openGame;
  openGame=async function(id){await baseOpenGame(id);const b=$('detail')?.querySelector('button.btn.green');if(b&&b.textContent.trim()==="I'M IN")b.textContent='REQUEST THIS SPOT'};

  const baseJoinGame=joinGame;
  joinGame=async function(id){
    const u=await getUser();
    if(u){const p=await sb.from('profiles').select('first_name,phone').eq('id',u.id).maybeSingle();if(!p.data?.first_name||!p.data?.phone){pendingAfterAuth='game:'+id;openProfile();const form=$('profileForm');if(form&&!form.querySelector('.onein-profile-note'))form.insertAdjacentHTML('afterbegin','<div class="ok onein-profile-note"><b>Almost there.</b><br>Complete your profile to request this spot. Your name and WhatsApp number help the organiser confirm you.</div>');return}}
    return baseJoinGame(id);
  };
})();
