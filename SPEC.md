# CardScout
Status: Week 07 PoC build. The owner's real spending, stock and pricing limits are provisional until Cerf confirms them. Business value still needs testing with users in Weeks 8 to 9.

## Who uses it
Staff at Cerf Collectables (an Australian online sports card business with 3 part-time and 1 full-time staff) who assess card offers, and Cerf, the owner, who sets the rules and reviews referred cases. Sole traders can use it the same way, as both assessor and owner.

## Problem
Buying decisions depend on the owner's judgement and repeated manual research (sold prices, player form, card details). CardScout records the owner's judgement once (Owner settings), uses an AI agent to do the research and draft the evidence, and applies the owner's rules the same way every time. Routine offers can be handled without the owner; uncertain or high-value offers go to the owner with reasons. Stream: Founder's Second Brain.

## Must-haves
- Enter a card offer and see saved offers.
- Owner settings: the owner's limits and CERF weights and thresholds.
- Assessment: eligible, decline, counteroffer or owner review, with reasons, from plain-code rules.
- AI draft: the agent researches sold prices and the player and drafts the CERF scores with sources; a person checks and submits.
- Should: FM26 player ratings as context on each offer, labelled unverified.

## Build Plan
1. Enter, save and list offers · Daniel (setup with Leonard)
2. FM player context on offers · Daniel
3. Owner settings and assessment · Daniel
4. AI draft agent · Daniel; agent tests with Leonard
5. Demo data: one realistic offer per outcome · Vignesh
6. Owner's real limits entered in settings · Luka and Pat (from Cerf)
Agent: research sold prices and player news for one offer and draft the five CERF scores with sources, for a person to check · Daniel builds, the team reviews AGENT.md
Check-ins: Thursday 22 Oct and Sunday 25 Oct on Teams
Each person brings: what they finished, a link to their commit, and where they are stuck

## Slices
Done:
1. Enter, save and list offers. Server checks every field; saved offers show newest first.
2. FM player context. Staff search and confirm the player; 15 ratings shown, labelled "unverified, not price evidence".
3. Owner settings and assessment. Settings page; assess form; rules in lib/assess.mjs give the four outcomes with reasons; tested live.

Now: AI draft agent
Story: The assessor opens an offer and clicks Prepare AI draft so they do not have to research sold prices and the player from scratch.
Data: reads card_offers, shop_settings and players; writes agent_runs; the assessment links the run (assessments.agent_run_id).
Rule: the agent never decides or buys; the server checks every sale and calculates the count and median; a person submits.
Done when:
1. With the team passcode, Prepare AI draft shows five scores with reasons and sources, the sales it found (accepted or not, and why) and questions for staff.
2. A wrong passcode runs nothing and saves no agent_runs row.
3. The assess form is pre-filled from the draft; stock and condition are left for the person.
4. The five tests in AGENT.md pass on the live site and their results are recorded.
Not in this slice: logins, an approved sales data feed, owner review queue.

Next:
5. Demo data, one offer per outcome.
6. Owner's real limits entered.
After Week 07: approved sold-sales source, owner review queue, logins and multiple shops, user testing.

## Data
- card_offers: id, created_at, player, year, set_name, card_number, variant, grade_condition, asking_price_aud, status (new, assessed, owner_review, closed), player_id, last_outcome.
- players: FM26 ratings, 34,644 rows, data_status UNVERIFIED_COMMUNITY.
- shop_settings: one row of owner settings, including provisional (database/003_settings_assessments.sql).
- assessments: offer_id, stock_count, condition, sales_count, median_sold_aud, evidence_source, five scores, cerf_total, cerf_category, offer_ceiling_aud, outcome, reasons, settings_snapshot, agent_run_id.
- agent_runs: offer_id, status, model, staff_notes, draft, sales, sales_count, median_sold_aud, trace, searches, input_tokens, output_tokens, error (database/004_agent_runs.sql).

## Rules
- Order: excluded set, failed condition or stock limit gives decline; then unsure condition or too few sales gives owner review; then CERF reject gives decline, speculative or watch gives owner review; then price against the ceiling and the staff limit.
- Offer ceiling = floor to cents of min(offer share x median, (1 - minimum margin) x median - selling costs).
- Eligible still needs a person to confirm. Nothing is bought automatically.

## Out of scope
Predicting future card prices; guaranteed profit; automatic purchases or payments; photo grading; collection management; player watchlists and alerts; real customer data; logins before Week 07.

## Architecture
Next.js server reads and writes Supabase; the browser only receives what it needs. SUPABASE_URL, SUPABASE_SECRET_KEY, ANTHROPIC_API_KEY and AGENT_PASSCODE live in .env.local and Vercel settings only. All tables have row level security on with no browser policies. The agent runs on the server (Claude via the Anthropic API with web search). No login yet, so the link is shared with the team and tutor only.

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
- 26 Oct 2026: Removed Topps Chrome from the provisional excluded sets, because it is one of the most popular football card lines and the exclusion was the placeholder, not Cerf's confirmed rule. 
