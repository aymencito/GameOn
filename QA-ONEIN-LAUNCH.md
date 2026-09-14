# ONEIN beta launch checklist

## Launch scope
Glasgow football beta only. Existing teams/groups use ONEIN to fill missing spots before kickoff.

## Critical player flow
- [ ] Open ONEIN on iPhone Safari
- [ ] Open ONEIN on Android Chrome
- [ ] Browse open games without signing in
- [ ] Venue and date filters work
- [ ] Open game details
- [ ] Sign in by email magic link
- [ ] Magic link returns to the same ONEIN game
- [ ] Complete profile with first name + WhatsApp/mobile
- [ ] Request one spot
- [ ] Duplicate request is blocked
- [ ] Own organiser cannot request their own game
- [ ] My Play shows pending request immediately
- [ ] Accepted request changes to YOU'RE IN
- [ ] Accepted player can message organiser on WhatsApp
- [ ] Declined/cancelled/expired games move to History

## Critical organiser flow
- [ ] Sign in with same account type used by players
- [ ] Post shortage for a future kickoff
- [ ] Past kickoff cannot be posted
- [ ] My Games shows the shortage immediately
- [ ] WhatsApp share contains venue, date, time, format, fee and exact ONEIN link
- [ ] Player request count matches Requests list
- [ ] Accept decrements players needed exactly once
- [ ] Accepting final required player marks game filled
- [ ] Remaining pending requests are declined when game fills
- [ ] Decline only declines the selected pending request
- [ ] Cancel removes game from active discovery
- [ ] Cancelled game remains in player/organiser history

## Shared-link and auth regression
- [ ] Shared game link opens ONEIN branding
- [ ] `?game=` deep link survives sign-in
- [ ] Refresh while signed in keeps session
- [ ] WhatsApp link does not fall back to GameOn branding
- [ ] Privacy and Beta terms links open successfully

## Mobile UX
- [ ] No horizontal scrolling at 320px width
- [ ] Bottom navigation clears iPhone safe area
- [ ] Buttons are easy to tap with one thumb
- [ ] Keyboard does not hide Save/Profile controls
- [ ] Loading, empty and error states are readable
- [ ] Long venue names wrap cleanly
- [ ] Cost/time/date remain legible on small screens

## Beta trust/safety
- [x] Privacy notice drafted
- [x] Beta terms drafted
- [x] Clarify that ONEIN does not currently take payments
- [x] Clarify that organisers/players confirm practical details directly
- [ ] Decide and publish a support/contact route
- [ ] Decide whether launch is 18+ only and reflect this in terms/onboarding
- [ ] Add simple report/block path before wider public launch

## Launch operations
- [ ] Recruit 5–10 trusted organisers
- [ ] Recruit first 30–50 players from existing local groups
- [ ] Prepare QR code for the final production URL
- [ ] Prepare organiser WhatsApp invite copy
- [ ] Prepare player WhatsApp invite copy
- [ ] Ask Super Soccer before putting up physical QR material

## Success criteria for widening beyond private beta
- 20+ genuine shortages posted
- 70–80%+ of shortages filled
- No critical account/auth/request-count bugs
- Multiple organisers use ONEIN more than once
- No unresolved safety/privacy blocker

## Rollback
The existing GameOn/ONEIN 2.6 path remains the rollback target until this checklist passes.
