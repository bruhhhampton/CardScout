# CardScout
Status: first build. The owner's real buying rules and the business value still need testing with users.

## Who uses it
A staff member at a small football card shop. They can look up card prices but need help applying the owner's buying rules.

## Problem connection
Staff cannot make routine buying decisions without asking the owner. CardScout helps staff prepare a buying assessment using market evidence, stock levels and the owner's rules. Cases that need owner judgement are sent to the owner with reasons and evidence. Our interview evidence is stronger for selling than buying, so this still needs testing.

## Chosen direction (option C)
The main flow is assessing a card offer. Football Manager (FM) player ratings are added later as extra context on each offer. They are labelled as unverified game data and are never treated as price evidence.

## Current slice: enter and list offers
A phone-friendly page with an offer form and a list of saved offers from public.card_offers, newest first.
Required fields: player, year, set_name, card_number, variant, grade_condition and asking_price_aud.
Save only through server code. Status is set to 'new'. The database creates id and created_at.
Show a clear success message after saving. Show helpful error messages without revealing keys or raw database errors.
No buying advice in this slice. Each offer shows 'Not assessed'.

## Data
card_offers:
- id: UUID, generated
- created_at: timestamp with time zone, generated
- player: text, not blank, max 120 characters
- year: whole number, 1900 to 2100
- set_name: text, not blank, max 120 characters
- card_number: text, not blank, max 40 characters
- variant: text, not blank, max 80 characters
- grade_condition: text, not blank, max 80 characters. Typed by the user and not checked by the app.
- asking_price_aud: number with up to 2 decimals, 0 to 1,000,000, in AUD
- status: text, default 'new'. Allowed values: new, assessed, owner_review, closed

## Acceptance criteria
1. The three sample offers appear newest first.
2. A valid submission creates exactly one record and the list shows it after refresh.
3. The server rejects blank fields, an invalid year, a negative price, more than two decimal places and a price that is not a number.
4. A failed save does not show success and does not clear what the user typed.
5. The secret key and raw database errors never reach the browser.
6. The page works on a phone. Labels, keyboard focus and error messages are clear.

## Later slices (not active now)
1. Owner rules and stock: save the owner's buying rules and stock levels. Apply them with plain code based on lib/policy.mjs (fictional test rules).
2. FM player context: add a players table with FM ratings. Staff confirm which player an offer refers to. The app shows the ratings next to the offer, labelled "Game ratings, unverified, not price evidence". Use only data we are allowed to use.
3. Market evidence: get recent sales for the exact card from an approved source. Keep the card details, date, currency and source link for every sale.
4. Agent: an AI agent spots missing information and chooses which tools to use (offer, stock, sales, FM ratings, owner rules). All calculations stay in plain code. It cannot buy anything or override the owner's rules.
5. Assessment and owner review: save the assessment with its evidence. Outcomes are eligible, decline, counteroffer or owner review. The owner records the final decision.

## Out of scope
Predicting future card prices; guaranteed profit; automatic purchases or payments; grading or recognising cards from photos; collection management; player watchlists and alerts; using real customer data.

## Architecture
The Next.js server reads and writes Supabase. The browser only receives the records it needs. SUPABASE_URL and SUPABASE_SECRET_KEY are kept in a private .env.local file and in the hosting settings. A secret never goes in a NEXT_PUBLIC_ variable.

## Done
Nothing built yet. Update this section after each slice is tested and committed.
