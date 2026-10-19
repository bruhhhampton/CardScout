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
