# Decisions and assumptions

## Direction
- Staff-focused football card purchasing assessment.
- Option C: the main flow is assessing a card offer against the owner's buying rules. Football Manager player ratings are shown as extra context on each offer.
- First build: enter, save and display one card offer.

## Platform
- Week 4 SDD preferred Python + Streamlit + SQLite. Team moved to GitHub + Codespaces + Supabase + Next.js + Vercel.
- Reasons: course-supported route, shared hosted database, public link for the Week 7 PoC, keys kept on the server.
- Trade-off: JavaScript instead of Python. Claude used instead of GitHub Copilot to write code; prompts logged in PROMPTS.md.

## FM26 player data
- Provided by Luka. Team confirmed we are allowed to use it for this project.
- Source: community FM26 dataset (github.com/vfxper/fm26), downloaded 15 Oct 2026.
- Stored as unverified game ratings. Never used as price or real performance evidence.
- CA/PA (potential) excluded because some values are scrambled and it would drift into price prediction.
- Staff confirm each player match; the app never matches automatically.

## Security
- Secret key kept in .env.local (Codespace) and Vercel settings only. Never in the repo, prompts or chat.
- Key replaced on 19 Oct 2026 after it appeared in screenshots; old keys deleted.
- Public link has no login, so it is shared with the team and tutor only. Only invented offer data is stored.

## Evidence boundary
- Interview evidence supports owner-led sourcing, limited staff knowledge and owner approval for high-value sales. How often staff assess purchases, and how painful it is, is still unconfirmed.
- No measured time savings, usage rate or willingness to pay yet.
- Existing price, buylist and inventory tools overlap with some functions.

## Open decisions
- Owner's real buying rules: staff spending limit, excluded sets, max copies, minimum margin (Pat and Luka to confirm with the owner).
- Outcomes: eligible, decline, counteroffer and owner review, or Buy / Don't Buy / Escalate.
- Persona: shop staff plus owner, or a sole trader like Cerf.
- Legal, approved source for recent sales data.
- Whether an AI agent is in scope for the PoC (ask the tutor at Week 7).

## Agent boundary
- Optional later tool orchestration. Fixed calculations and policy checks stay in plain code. No automatic purchases.

## AI agent
- Tutor approved adding the agent before Week 07.
- Bounded agent drafts evidence and CERF scores with sources; it never decides, buys, counts sales or calculates prices. Design in AGENT.md.
- Model: Claude via the Anthropic API (ANTHROPIC_MODEL, default claude-sonnet-5-5), chosen over the Gemini free tier for built-in web search, no demo-day quota limits and paid-API privacy. Key kept server-side only.
- Sold prices come from web search until an approved data source is found. Every sale needs a link the agent actually saw; the server checks and counts them.
- Staff confirm stock, condition and every draft value before the plain-code rules run.
- Team passcode and daily cap (default 30) because the link has no login. Web search costs about $10 per 1,000 searches plus tokens.

## Owner exceptions (12 Nov 2026)
- Decision: when the owner decides a card (Buy or Offer), CardScout follows that decision the next time the same card comes in, even if one of his "don't buy" rules (base cards, makers, expensive cards, defects, rookie cards only) flags it. This is how CardScout evolves from the owner's feedback, as the course feedback asked, rather than applying only static rules.
- Limits: same card only (player, year, set and version); never above what the owner paid or the staff limit; the set, condition, stock and first-team checks still stop a card; a person still records every decision and nothing is bought automatically. The owner can remove any exception in Settings under Learned decisions.
- From single decisions to rules: after the owner overrides the same rule 3 times, the Owner tab suggests changing the rule itself.
- On screen: the card page says "Owner exception" with the date and his decision, and in Details the overridden rule reads "Overridden by the owner's decision" instead of "Stops here", so the recommendation and the explanation agree.
- Considered and not chosen: making "don't buy" rules strict (the card would go back to the owner every time, so nothing would be learned). An expiry date on exceptions was discussed and left for later.
