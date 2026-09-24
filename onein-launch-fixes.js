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
        // The wrapper forwarded the fragment into this same-origin iframe so
        // Supabase could restore the session. Remove it here as well once used.
        window.history.replaceState(null,'',window.location.pathname+window.location.search);
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

  // A profile is required before requesting a spot. Validate the two required
  // fields and confirm Supabase returned the saved row before navigating away.
  saveProfile=async function(){
    await restoreOneinSession;
    const user=await getUser();
    const firstName=$('firstName').value.trim();
    const phone=$('phone').value.trim();
    const area=$('area').value.trim();
    const skillLevel=$('skill').value||null;
    const button=$('profileForm')?.querySelector('.btn.green');
    $('profileErr').innerHTML='';
    if(!user){
      $('profileErr').innerHTML='<div class="error">Your session has expired. Please sign in again.</div>';
      return;
    }
    if(!firstName||!phone){
      $('profileErr').innerHTML='<div class="error">Enter your first name and WhatsApp/mobile number.</div>';
      return;
    }
    if(button?.disabled)return;
    if(button){button.disabled=true;button.textContent='SAVING…'}
    try{
      const result=await sb.from('profiles').upsert({
        id:user.id,
        first_name:firstName,
        phone,
        area,
        skill_level:skillLevel,
        updated_at:new Date().toISOString()
      },{onConflict:'id'}).select('id,first_name,phone,area,skill_level').single();
      if(result.error)throw result.error;
      if(!result.data||result.data.first_name!==firstName||result.data.phone!==phone){
        throw new Error('The saved profile could not be verified.');
      }
      if(pendingAfterAuth){
        const next=pendingAfterAuth;
        pendingAfterAuth=null;
        if(next==='short')return shortFlow();
        if(next.startsWith('game:'))return openGame(next.split(':')[1]);
      }
      return openMe();
    }catch(error){
      console.error('ONEIN profile save failed',error);
      $('profileErr').innerHTML='<div class="error">'+esc(error.message||'We could not save your profile. Please try again.')+'</div>';
    }finally{
      if(button){button.disabled=false;button.textContent='SAVE PROFILE'}
    }
  };

  const waNumber=(p)=>{let n=String(p||'').replace(/\D/g,'');if(n.startsWith('00'))n=n.slice(2);if(n.startsWith('0'))n='44'+n.slice(1);return n};
  const openExternal=(url)=>{try{window.top.location.href=url}catch(e){window.open(url,'_blank')}};

  const missingRpc=error=>/function|schema cache|could not find/i.test(String(error?.message||''));

  // WhatsApp must escape the iframe. The secure RPC returns contact details
  // only after acceptance; the fallback keeps the live beta compatible until
  // the security migration has been applied.
  acceptWhats=async function(id,p,n){
    let q=await sb.rpc('organiser_accept_request_secure',{p_request_id:id});
    if(q.error&&missingRpc(q.error)){
      q=await sb.rpc('organiser_decide_request',{p_request_id:id,p_decision:'accepted'});
      if(q.error){alert(q.error.message);return}
    }else if(q.error){alert(q.error.message);return}
    const accepted=q.data?.[0]||{};
    const name=accepted.player_name||n||'player';
    const phone=waNumber(accepted.player_phone||p);
    if(phone)openExternal('https://wa.me/'+phone+'?text='+encodeURIComponent(`Hi ${name}, you're in ⚽ See you at the game! — ONEIN`));
    else alert('Player accepted. They have no WhatsApp/mobile number saved in ONEIN.');
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

  // Just-in-time privacy information beside the fields where contact data is
  // collected. The database migration enforces the same sharing boundary.
  const phoneInput=$('phone');
  if(phoneInput){
    phoneInput.maxLength=20;
    phoneInput.autocomplete='tel';
  }
  const firstNameInput=$('firstName');
  if(firstNameInput){
    firstNameInput.maxLength=50;
    firstNameInput.autocomplete='given-name';
  }
  const profileForm=$('profileForm');
  if(profileForm&&!profileForm.querySelector('.onein-privacy-copy')){
    const saveButton=profileForm.querySelector('.btn.green');
    saveButton?.insertAdjacentHTML('beforebegin','<div class="phoneHint onein-privacy-copy" style="margin:10px 0 4px">Privacy: your name and level are shown to the organiser when you request a spot. Your phone number is released only after they accept you. An organiser\'s number is released only to accepted players.</div>');
  }
})();
