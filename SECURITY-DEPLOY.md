# ONEIN security deployment

The v4 frontend is backward-compatible. It tries the hardened RPCs first and
temporarily falls back to the existing v2.6 RPCs when the migration is not yet
present.

## Deployment order

1. Deploy `gameon-2.6.js`, `onein-launch-fixes.js`, and the `v2-6.html` cache
   bump.
2. In the Supabase SQL Editor for the ONEIN project, run
   `supabase/onein-security-hardening.sql` once.
3. Verify:
   - signed-out users can call `get_open_games` but cannot select the
     `profiles`, `games`, or `join_requests` tables directly;
   - a player sees the organiser phone only for an accepted, future game;
   - an organiser's pending-request list contains no player phone;
   - `organiser_accept_request_secure` returns the player's contact only after
     a successful acceptance;
   - game creation still succeeds through `create_game_secure`.

## Supabase dashboard settings

Before widening the beta, review **Authentication → Rate Limits** and enable
email rate limits appropriate for a small beta. If public sign-ups are opened,
enable Supabase CAPTCHA for passwordless sign-in as well.

Do not place a Supabase service-role key in this repository or in browser code.
The publishable key in the client is expected; the RLS policies and checked
RPCs are the security boundary.
