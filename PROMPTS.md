## Entry 1
Date/time: 19 Oct 2026
Member: Daniel
Slice: 1 - display seeded offers
Tool: Claude (instead of Copilot)
Exact prompt: "Build Step 6: a Next.js page that lists card_offers from Supabase newest first, reading on the server only with SUPABASE_URL and SUPABASE_SECRET_KEY, showing 'Not assessed', with no secrets or raw database errors reaching the browser."
Result: kept
What changed: Added Next.js app (app/, lib/, package.json). Server-only Supabase connection. Offer list page.
Validation performed and outcome: 3 seeded offers showed. Added Demo Player D in Supabase and it appeared at the top after refresh. .env.local not in Source Control.
Commit: Show card offers from Supabase

## Entry 2
Date/time: 19 Oct 2026
Member: Daniel
Slice: 1 - save one offer
Tool: Claude (instead of Copilot)
Exact prompt: "Build Step 7: add a form that saves a new card offer to card_offers on the server. Check every SPEC limit on the server (blank fields, year 1900 to 2100, price 0 to 1,000,000 with at most two decimals, reject non-numbers). Keep what the user typed if saving fails, show clear field errors, stop double submits, then show the new offer at the top of the list."
Result: kept, with one fix
What changed: Added offer form (app/offer-form.js), server save action (app/actions.js), server-side validation (lib/validate-offer.js), createOffer in lib/offers.js. Fix: Codespaces blocked form submits ("Invalid Server Actions request") because it forwards the app through *.app.github.dev, so next.config.mjs now trusts that address in development only.
Validation performed and outcome: Blank player, year "abcd" and price "1.234" were rejected with field messages and typed values kept. Valid offer (Demo Player E, 95.50) saved once, appeared at the top as Not assessed and showed in Supabase with status new.
Commit: Add form to save a new offer

## Entry 3
Date/time: 19 Oct 2026
Member: Daniel
Slice: 1 - publish
Tool: Vercel (no AI prompt)
What changed: Deployed to Vercel at card-scout-psi.vercel.app. SUPABASE_URL and SUPABASE_SECRET_KEY set in Vercel settings. Replaced the secret key after it appeared in screenshots and deleted the old keys.
Validation performed and outcome: Opened the link on a phone using mobile data. Added Demo Player F from the phone and it appeared in Supabase. Site still loads offers after the key change.
Commit: Log publish step

## Entry 4
Date/time: 19 Oct 2026
Member: Daniel
Slice: 2 - FM player context
Tool: Claude (instead of Copilot)
Exact prompt: "Show Luka's FM26 player data next to an offer. Staff search and confirm the player (no automatic matching). Show the ratings with a clear 'unverified, not price evidence' label. It must not change the assessment."
Result: kept
What changed: Added players table (34,644 rows) and player_id link on card_offers. Added offer page (app/offers/[id]) with player search, link and unlink, and ratings display. Offer list shows the linked player.
Validation performed and outcome: On the live site (card-scout-psi.vercel.app), searched "Bukayo Saka", confirmed the match and linked him to an offer. 15 ratings shown with the "unverified, not price evidence" label and source. Offer list showed "FM player: Bukayo Saka". Offer status stayed "Not assessed".
Commit: Add FM player context to offers

## Entry 5
Date/time: 21 Oct 2026
Member: Daniel
Slice: 3 - owner settings and assessment
Tool: Claude (instead of Copilot)
Exact prompt: "Build option A: one shop with an Owner settings page the owner fills in (staff limit, max copies, excluded sets, pricing, evidence needed, and Cerf's CERF weights and thresholds, pre-filled as provisional). Add an assess form on each offer for stock, condition, sold sales and the five CERF scores. Apply the rules in plain code, not AI, and give eligible, decline, counteroffer or owner review with reasons. Save each assessment and show the outcome on the list."
Result: kept
What changed: Added shop_settings and assessments tables (database/003_settings_assessments.sql), /settings page, assess form and result on the offer page, rules engine lib/assess.mjs with 21 synthetic tests (evaluation/assess_tests.mjs), outcome badges on the list. Updated SPEC.md.
Validation performed and outcome: 21 synthetic rule checks passed. On the live site, settings loaded and saved. Bukayo Saka offer gave all four outcomes using synthetic sales: Eligible (median $150, ceiling $112.50, CERF 80), Owner review (condition not sure), Counteroffer (median $100, ceiling $75) and Decline (football quality 50, below reject level 60).
Commit: Add owner settings and assessment
