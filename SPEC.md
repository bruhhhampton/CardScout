# CardScout
Status: Week 07 PoC, 29 Oct 2026 (after the live overseas and paste tests). The owner's real spending, stock and pricing limits are provisional until Cerf confirms them. Business value still needs testing with users in Weeks 8 to 9.

## Who uses it
Staff at Cerf Collectables (an Australian online sports card business with 3 part-time and 1 full-time staff) who assess card offers, and Cerf, the owner, who sets the rules and reviews referred cases. Sole traders can use it the same way, as both assessor and owner.

## Problem
Buying decisions depend on the owner's judgement and repeated manual research (sold prices, player form, card details). CardScout records the owner's judgement once (Owner settings), uses an AI agent to do the research and draft the evidence, and applies the owner's rules the same way every time. Routine offers can be handled without the owner; uncertain or high-value offers go to the owner with reasons. Stream: Founder's Second Brain.

## Must-haves
- Enter a card offer and see saved offers.
- Owner settings: the owner's limits and CERF weights and thresholds.
- Assessment: eligible, decline, counteroffer or owner review, with reasons, from plain-code rules, including Cerf's rookie card and first-team gates.
- AI draft: the agent researches sold prices and the player and drafts the CERF scores and Cerf's two checks with sources; the rules work out a verdict straight away, and a person confirms it or changes something.
- Should: FM26 player ratings as context on each offer, labelled unverified.

## Build Plan
1. Enter, save and list offers · Daniel (setup with Leonard)
2. FM player context on offers · Daniel
3. Owner settings and assessment · Daniel
4. AI draft agent · Daniel; agent tests with Leonard
5. Demo data: one realistic offer per outcome · Vignesh
6. Owner's real limits entered in settings · Luka and Pat (from Cerf)
7. Fewer clicks, Cerf's gates and leaner assessment form · Daniel
9. One click draft and verdict, FM role fit, overseas sales and the paste box · Daniel
8. Owner review list (filter offers waiting for Cerf) · Vignesh, after Week 07
Agent: research sold prices and player news for one offer and draft the five CERF scores with sources, for a person to check · Daniel builds, the team reviews AGENT.md
Check-ins: Thursday 22 Oct and Sunday 25 Oct on Teams
Each person brings: what they finished, a link to their commit, and where they are stuck

## Slices
Done:
1. Enter, save and list offers. Server checks every field; saved offers show newest first.
2. FM player context. Staff search and confirm the player; 15 ratings shown, labelled "unverified, not price evidence".
3. Owner settings and assessment. Settings page; assess form; rules in lib/assess.mjs give the four outcomes with reasons; tested live.
4. AI draft agent. Draft with five sourced scores, server-checked sales and questions for staff; passcode and daily cap; all six AGENT.md tests passed on the live site (25 and 26 Oct).
5. Fewer clicks. Saving opens the offer; player match first; passcode remembered on a device; confirming the player starts the draft.
6. Cerf's gates. Rookie card and first-team questions; No gives Decline, Not sure gives Owner review; tested live with the Yamal card.
7. Leaner assessment form. Draft sales and scores shown as a one-line summary with Edit; Assess again fills in from the last assessment; Watch reason names what failed.
8. FM role fit and the agent drafts Cerf's checks. Football quality = 80% real-world + 20% FM role fit from Cerf's role profiles.
9. One click. Staff enter stock, condition and optionally the rookie card answer; one button gives the draft and a verdict marked not confirmed; a person confirms it.
10. Overseas sales and the paste box. US, UK and EU sales converted with today's rates and Cerf's adjustment and labelled overseas; staff paste sale rows from SportsCardsPro or eBay and CardScout writes the note; eBay Australia and SportsCardsPro search links on each offer.

Now: Week 07 PoC demo (rehearsal, backup recording).

Next:
- Owner's real limits entered (from Cerf).
- Remember sales per card, so the next offer for the same card starts with them.
- Trial a licensed price source (for example the SportsCardsPro API) instead of copying rows.
- Simpler Owner settings: basics first, a worked example, Cerf's model under Advanced.
- Owner review list for Cerf.
After Week 07: approved sold-sales source, stock from an inventory list, logins and multiple shops, user testing with Cerf.

## Data
- card_offers: id, created_at, player, year, set_name, card_number, variant, grade_condition, asking_price_aud, status (new, assessed, owner_review, closed), player_id, last_outcome.
- players: FM26 ratings, 34,644 rows, data_status UNVERIFIED_COMMUNITY.
- shop_settings: one row of owner settings, including provisional (database/003_settings_assessments.sql) and count_overseas, overseas_adjust and optional fx_usd_aud, fx_gbp_aud, fx_eur_aud (database/008_overseas.sql).
- assessments: offer_id, stock_count, condition, rookie_card, first_team (yes, no, unsure; database/005_gates.sql), football_real, fm_fit, fm_role (database/006_fm_fit.sql), prepared_by, confirmed, confirmed_at (database/007_confirm.sql), sales_count, median_sold_aud, evidence_source, five scores, cerf_total, cerf_category, offer_ceiling_aud, outcome, reasons, settings_snapshot, agent_run_id.
- agent_runs: offer_id, status, model, staff_notes, draft, sales, sales_count, median_sold_aud, trace, searches, input_tokens, output_tokens, error (database/004_agent_runs.sql).

## Rules
- Order: excluded set, failed condition, not a recognised rookie card, no first-team chance or stock limit gives decline; unsure rookie card or first-team chance also gives owner review; then unsure condition or too few sales gives owner review; then CERF reject gives decline, speculative or watch gives owner review; then price against the ceiling and the staff limit.
- Offer ceiling = floor to cents of min(offer share x median, (1 - minimum margin) x median - selling costs).
- Football quality = 80% real-world score (agent) + 20% FM role fit (plain code); the speculative check uses the real-world score only.
- Overseas sale in AUD = price × today's rate × owner adjustment (85% provisional), only if the owner counts overseas sales.
- A staff rookie card answer from the card wins over the agent's; an agent Yes or No without a source counts as Not sure.
- Every verdict, including one prepared from the AI draft, needs a person to confirm. Nothing is bought automatically.

## Out of scope
Predicting future card prices; guaranteed profit; automatic purchases or payments; photo grading; collection management; player watchlists and alerts; real customer data; logins before Week 07.

## Architecture
Next.js server reads and writes Supabase; the browser only receives what it needs. SUPABASE_URL, SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY and AGENT_PASSCODE live in .env.local and Vercel settings only. All tables have row level security on with no browser policies. The agent runs on the server (Claude via the Anthropic API with web search). Exchange rates come from the free Frankfurter API, cached for a day. CardScout does not scrape sales sites; staff open eBay or SportsCardsPro themselves and paste what they find. No login yet, so the link is shared with the team and tutor only.

## Decisions
- 15 Oct 2026: Build on GitHub, Codespaces, Supabase, Next.js and Vercel instead of Python and Streamlit or Power Apps, because it is the course-supported route, gives a shared hosted database and a public link, and keeps keys on the server.
- 15 Oct 2026: Option C, offer assessment as the main flow with FM ratings as context, because tutor feedback focused the problem on buying decisions and game ratings cannot price a card.
- 19 Oct 2026: Replaced the Supabase secret key and deleted the old ones, because the key appeared in screenshots.
- 19 Oct 2026: FM26 data stored as unverified, CA and PA excluded, staff confirm each player match, because the community data is unverified and CA and PA drift into price prediction.
- 21 Oct 2026: Option A, one shop with editable owner settings pre-filled with Cerf's CERF model, because each owner's judgement differs and logins for many shops are too large before Week 07.
- 21 Oct 2026: Outcomes come from plain code, never the AI, because the same inputs must always give the same answer and mentors and owners must be able to check it.
- 25 Oct 2026: Agent on Claude (Anthropic API, paid) rather than the Gemini free tier, because web search is built in and already tested, there are no free-tier quota limits during the demo, and paid API data is not used for training by default.
- 25 Oct 2026: Agent passcode and daily cap, because the public link has no login and AI calls cost money.
- 26 Oct 2026: Main users are Cerf Collectables staff, with Cerf reviewing referred cases, because our Week 2 research shows the business has 3 part-time and 1 full-time staff. The Yamal story is cited to our Week 4 user story, not the 21 Sept interview, which does not mention it.
- 26 Oct 2026: Focus on individual sports cards, because buylist software such as SortSwift already applies owner rules to card games with a catalogue price, and individual sports cards have none, so their evidence has to be gathered first.
- 26 Oct 2026: Removed Topps Chrome from the provisional excluded sets, because it is one of the most popular football card lines and the exclusion was a placeholder, not Cerf's confirmed rule. Cerf's own notes value a Chrome /50 card.
- 28 Oct 2026: Fewer steps per offer: saving an offer opens it, the player match comes before the AI draft, the team passcode can be remembered on a device for 30 days (httpOnly cookie holding a hash, never the passcode) and confirming the player then starts the AI draft. Staff still check the draft and run the assessment themselves, because buying decisions stay with a person.
- 28 Oct 2026: Added Cerf's two gates from his CERF model (cerf.py): not a recognised rookie card, or no first-team chance, means Decline; Not sure means Owner review. Staff answer both on the assessment. They were previously folded into the card and career scores, which let high scores outweigh them.
- 29 Oct 2026: Provisional sales window widened from 30 to 90 days, matching the 90-day evidence limit in Cerf's cerf.py, because recent Australian sales of individual sports cards are thin. Minimum stays at 3 sales. Still provisional until Cerf confirms.
- 29 Oct 2026: Leaner assessment form: sales, middle price and scores from the AI draft are shown as a summary staff can edit, and Assess again fills in from the last assessment, so staff only enter what needs a person (stock, condition, Cerf's two checks) and approve.
- 29 Oct 2026: FM ratings count for 20% of football quality as role fit, using the role profiles in Cerf's cerf.py, with real-world evidence 80%. Game ratings are unverified, so they never set the price and never count alone.
- 29 Oct 2026: One click prepares the draft and the verdict, saved as not confirmed until a person confirms it, because staff were re-entering what the agent had already found. Buying decisions still stay with a person.
- 29 Oct 2026: Overseas sales can count, converted with today's exchange rates and an owner adjustment (85% provisional), and labelled overseas, because recent Australian sales of single cards are thin and the agent's web search mostly finds US sales. Cerf decides whether they count.
- 29 Oct 2026: Staff paste sale rows and CardScout writes the note, instead of scraping eBay or SportsCardsPro, because scraping breaks those sites' terms and eBay's sold-sales API is restricted. A licensed source is a later step.
- 29 Oct 2026: Staff can answer the rookie card check from the card, and their answer wins, because the RC logo is printed on the card and the web often cannot prove it. First-team chance stays with the agent.
- 4 Nov 2026: Week 7 feedback said CardScout was too slow for staff. The AI now runs in the background, the FM player links itself when the name matches exactly, stock and condition have defaults, and pasted sales cut the agent to 3 searches. A person still confirms every verdict.
- 5 Nov 2026: Bought SportsCardsPro Legendary (US$49/month) for its Prices API. It gives one value per grade and suggested shop buy and sell prices, but no individual sales and no price history, so it is shown beside real sales and only replaces them when Cerf allows it for cheaper cards. Their data is licensed for internal use only, so it stays off on the live site until they reply to our permission email.
