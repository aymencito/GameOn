# GameOn 2.6 regression checklist

## Backend prerequisite
Run `supabase/gameon-2.6-consolidated.sql` once in Supabase SQL Editor before testing 2.6.

## Player flow
- Find a future open game while signed out.
- Open Game Details from Find a Game.
- Open the same game from a shared `?game=` link.
- Sign in from the shared game and confirm the magic link returns to the same 2.6 game.
- Complete profile if required.
- Request one place.
- Confirm My Play immediately shows `WAITING FOR ORGANISER` under Latest Activity and Waiting.
- Confirm the same account cannot request the same game twice.
- After organiser accepts, confirm My Play shows `YOU'RE IN` under Latest Activity and Upcoming.
- Confirm Message Organiser opens WhatsApp only for an accepted request.
- After kickoff passes, confirm the game leaves Waiting/Upcoming and appears in History as finished.

## Organiser flow
- Post a future shortage.
- Reject a date/time already in the past.
- Confirm My Games shows the correct remaining players needed.
- With zero requests, confirm button shows `REQUESTS 0` and Requests screen says `No pending player requests.`
- With one pending request, confirm button shows `REQUESTS 1` and exactly one player is listed.
- Accept one request and confirm players needed decrements exactly once.
- Decline one request and confirm players needed does not change.
- Fill the final place and confirm game disappears from active My Games and Find a Game.
- Cancel a game and confirm it disappears from active My Games and player My Play records move out of active state.
- After kickoff passes, confirm the game disappears from active My Games automatically.

## Shared links / WhatsApp
- WhatsApp share must point to `/v2-6.html?game=<id>` rather than an older build.
- Shared game link must preserve the exact game through email magic-link authentication.
- Accept & WhatsApp must use the player's saved GameOn mobile number.

## Visual / navigation
- `I WANT TO PLAY` heading and description must be light text on the green card.
- Bottom navigation: Home / My Play / My Games / Me.
- No old 2.5 warning text should ever appear.
- 2.6 shell stays non-interactive until the consolidated patch is loaded.
