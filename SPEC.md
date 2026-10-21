# CardScout
Status: PoC build. The owner's real spending, stock and pricing limits still need confirming. Business value still needs testing with users.

## Who uses it
Cerf, the owner of a small football card business, and anyone who assesses card offers for him. Whether Cerf has staff or works alone is still to be confirmed; the app works either way.

## Problem connection
Buying decisions depend on the owner's judgement. CardScout records that judgement once (Owner settings) and applies it the same way to every offer, so routine cases can be handled without the owner and uncertain or high-value cases go to the owner with reasons. Stream: Founder's Second Brain.

## Chosen direction
- Option C: the main flow is assessing a card offer. Football Manager (FM) ratings are shown as context, labelled unverified and never treated as price evidence.
- Option A for settings: one shop with editable owner settings. Multi-shop logins are a later step.
- The owner's own CERF model (weights and thresholds) is the player judgement. Defaults come from Cerf's CERF model.

## Built slices
1. Enter, save and list offers (server checks on every field).
2. FM player context: staff search and confirm the player; 15 ratings shown with an "unverified, not price evidence" label.
3. Owner settings and assessment (this slice).

## Current slice: owner settings and assessment
- Owner settings page (/settings): staff limit, max copies, excluded sets, offer share, minimum margin, selling costs, sales evidence needed, CERF weights (must add up to 100) and CERF thresholds. Checked on the server. Default limits are provisional placeholders.
- Assess form on each offer: copies in stock, condition (meets / does not meet / not sure), matching sold sales and their median, evidence source, and five CERF scores (0 to 100) entered by a person.
- Rules run in plain code (lib/assess.mjs), never by an AI. Order: hard shop rules (excluded set, failed condition, stock limit) then missing information then CERF category then price against the ceiling and staff limit.
- Offer ceiling = floor to cents of min(offer share x median, (1 - minimum margin) x median - selling costs).
- Outcomes: eligible, decline, counteroffer, owner review. Each has plain reasons. Eligible still needs a person to confirm. Nothing is bought automatically.
- Each assessment is saved with its inputs and a copy of the settings used. The offer list shows the latest outcome.

## Data
- card_offers: id, created_at, player, year, set_name, card_number, variant, grade_condition, asking_price_aud, status (new, assessed, owner_review, closed), player_id (link to players), last_outcome.
- players: FM26 ratings, 34,644 rows, data_status UNVERIFIED_COMMUNITY.
- shop_settings: one row of owner settings (see database/003_settings_assessments.sql).
- assessments: offer_id, inputs, cerf_total, cerf_category, offer_ceiling_aud, outcome, reasons, settings_snapshot.

## Acceptance criteria (this slice)
1. Settings show the provisional defaults and save valid changes.
2. Settings reject non-numbers, out-of-range values, more than 2 decimals for money and weights that do not add up to 100, keeping what was typed.
3. An assessment with missing or invalid fields is rejected on the server with field messages.
4. The same inputs and settings always give the same outcome and reasons (evaluation/assess_tests.mjs).
5. Excluded set, failed condition or stock limit gives decline before anything else.
6. Too few sales or unsure condition gives owner review.
7. The saved assessment and the offer list show the outcome.

## Later slices
- Approved source for sold sales, keeping card identity, date, currency and link for each sale.
- Agent: spots missing information, chooses tools (offer, stock, sales, FM, rules), drafts a sourced assessment. Calculations stay in code. Check with the tutor first.
- Owner review queue: owner approves, rejects or asks for more information; final decision recorded.
- Logins and multiple shops.

## Out of scope
Predicting future card prices; guaranteed profit; automatic purchases or payments; photo grading; collection management; player watchlists and alerts; real customer data.

## Architecture
Next.js server reads and writes Supabase; the browser only receives what it needs. SUPABASE_URL and SUPABASE_SECRET_KEY live in .env.local and Vercel settings only. All tables have row level security on with no browser policies. No login yet, so the link is shared with the team and tutor only.

## Done
- Slice 1 tested and live (card-scout-psi.vercel.app).
- Slice 2 tested and live.
- Slice 3: tested against a test database; live test still to do.
