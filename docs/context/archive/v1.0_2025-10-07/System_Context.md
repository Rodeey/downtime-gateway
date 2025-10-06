Downtime System Context
Last synced: 2025-10-07 (v1.0)
Mission & Vision
Mission: Democratize local discovery by connecting people with real-time experiences and empowering small businesses with effortless marketing.
Core Question: "What can I do right now?"
Vision: Own the "Right Now" category — becoming the definitive answer to spontaneous discovery, not tomorrow or next week, but this moment.
Founder Principles

Strategy First: Opportunity cost, roadmap, document, align before action
Lean Startup: Test assumptions, iterate based on feedback
Execution Over Ideas: Ideas don't change lives, execution does
Cost-First Thinking: Every feature must consider API costs
Measure Ruthlessly: Track metrics, adjust based on data

Current Architecture Overview
Tech Stack

Frontend: Next.js (Pages Router), React, Tailwind CSS
Backend: Zuplo API Gateway (custom serverless orchestration)
Database: Supabase (PostgreSQL)
Caching: Supabase + in-memory (15-minute grid-based)
Analytics: PostHog
Hosting: Vercel

Repository Structure

downtime - Main Next.js user-facing application
downtime-gateway - New API gateway for cost-optimized data orchestration

Backend Data Flow
Request Pipeline (High-Level)
1. User Opens App
   ↓
2. Check Supabase Cache (15min freshness per 1km² grid × category × 2h bucket)
   ↓
3. If Fresh: Return cached results immediately
   If Stale: Call API Gateway
   ↓
4. API Gateway Orchestrates:
   - OSM (free) for Parks/Outdoors
   - Foursquare (free tier, 99k calls/month) for Food/Drink
   - Yelp ($299/month flat rate) for detailed business data
   - Google (expensive) ONLY as last resort fallback
   ↓
5. Apply Logic Pipeline:
   - filters.ts → Remove junk (fast food, gas, duplicates)
   - hours.ts → Attach open_now status
   - ranker.ts → Order by distance, open_now, popularity
   ↓
6. Normalize & Deduplicate Results
   ↓
7. Store in Supabase Cache
   ↓
8. Return to Frontend
Data Flow Details (/api/places endpoint)
Request hits /places
→ Params: lat, lng, radius, categories
→ api-logic.ts (orchestrator)
   → For each category:
     → Check cache via supabase.ts
     → If cached count < minimum threshold → fetch from providers
     → Enforce caps (trim extra results per category)
     → Merge + normalize results
   → Apply Logic Pipeline:
     → filters.ts (remove irrelevant)
     → hours.ts (attach open_now)
     → ranker.ts (order results)
   → Write to Supabase:
     → request_logs (metadata)
     → cached_places (raw API JSON)
     → Later: places (normalized DB records)
   → Return to frontend: JSON of normalized, capped, filtered places
Frontend–Backend Contract Map
Expected Response Format
Always includes: name, lat, lng, address, category, open_now, distance
Optional extras: ratings, phone, social_links, website_url, walk_min, drive_min
Key Components & Data Dependencies
PlaceCard.tsx

Inputs: place object with standard contract
Displays: name, distance, open_now badge, categories, travel times
Maps: website_url, social_links for buttons

CategoryChips.tsx

Inputs: categories_available array of {name, count}
Uses: categoryLabels.ts for display mapping

MapView.tsx

Inputs: array of places with location: {lat, lng}
Requires: Google Maps via dynamic import

Travel Times

Old: computed live via Google Distance Matrix
New: pre-computed in backend (walk_min, drive_min)
Components read: place.walk_min / place.drive_min directly

Provider Logic & Cost Strategy
Provider Priority (Free-First)

OSM (OpenStreetMap) - FREE, always

Use for: Parks, landmarks, public spaces
Limitations: Less data on hours, phone, reviews


Foursquare - FREE tier (99,000 calls/month)

Use for: Restaurant/bar/cafe discovery
Primary source for Food & Drink until free tier exhausted


Yelp Fusion API - $299/month flat rate

Unlimited calls within reasonable use
Excellent for: Business details, hours, phone, reviews, dog-friendly
Use as: Primary paid source (predictable cost)


Google Places - Pay per use (EXPENSIVE)

Use ONLY as fallback when others fail
Implement: Strict rate limiting, aggressive caching (15min+)



Expected Monthly Cost at 1,000 DAUs

Yelp API: $299/month (fixed)
Foursquare: $0 (within free tier)
OSM: $0 (always free)
Google fallback: $0-50 (minimal usage with caching)
TOTAL: ~$300-350/month ✅ Sustainable!

API and Cache Rules
Caching Strategy

Cache Window: 15 minutes per 1km² grid × category × 2-hour time bucket
Purpose: Slashes repeat API calls, keeps costs predictable
Storage: Supabase cached_places table (raw API JSON)
Future: Normalized records in places table

Category Thresholds (Michigan MVP)

Food & Drink → min 50, cap 50
Outdoors & Parks → min 40, cap 40
Shops & Errands → min 35, cap 35
Arts & Culture → min 25, cap 25
Activities & Fun → min 30, cap 30
Coffee & WFH → min 20, cap 20
Total cap per request = 200

Radius Rules (Category-Specific)

Food/Shops/Nightlife: 5mi default → 15-20mi rural fallback
Arts: 7mi default → 18mi rural fallback
Parks: 10mi default → 25mi rural fallback
Outdoors: 15mi default → 30mi rural fallback

Quality Rules

Junk Exclusions: Remove fast_food, gas_station, convenience, adult
Beloved Exceptions: Keep cult favorites via allowlist
Indie Boost: +0.1 score for local/independent tags
Open Now Gate: If isOpenNow===false → exclude from feed

Call Budget

Max 2 calls per category: 1 primary + 1 optional Fill
If results < 11 after filtering → trigger Fill (relax chains, widen radius)
Cap final results at 20 per category

Current Development Status
Current Phase: Phase 0 - Cost Optimization (October 2025)
Priority: Achieve 1,000 DAUs without breaking the bank
Completed:

✅ Doggo Now pilot tested successfully
✅ Downtime v1 launched (live version)
✅ Cost crisis identified and pivot strategy developed
✅ downtime-gateway repo created

In Progress (Week 1-2):

✅ Finalize Yelp API integration ($299/month)
✅ Implement OSM for Parks/Outdoors
✅ Add Foursquare free tier
✅ Deploy 15-minute caching
⚠️ Test with 100 simulated users
⚠️ Verify monthly cost stays under $400

Next Steps (Week 3-4):

Deploy downtime-gateway
Add PostHog analytics
Implement request logging to Supabase
Load test with 1,000 simulated users
Fix any performance issues
Document API costs per endpoint

Phase 1 (Month 2): Launch

Soft launch to friends & family (50 users)
Detroit subreddit marketing
TikTok content creation
Partnership with 10 Detroit businesses
QR codes at 5 venues
Target: 100-200 DAUs

Phase 2 (Month 3-4): Growth

Product Hunt launch
Press outreach (Detroit media)
Influencer partnerships
Scale to 500 DAUs
Measure retention and iterate

Key Metrics
User Metrics: DAU, WAU, D1/D7 return rate, session length
Business Metrics: Active partners, posts/week, conversion rates
Platform Metrics: Fresh items per neighborhood, data accuracy (<5% false positives)
Financial Metrics: MRR, CAC, LTV, burn rate
Known Risks & Mitigations
Technical Risks

Empty Cache on First Load: Pre-warm cache for popular grids
API Rate Limits: Queue calls, exponential backoff
Data Accuracy: Multi-source verification, user reporting, daily refresh

Business Risks

Can't reach 1,000 DAUs with Detroit alone: Expand to Ann Arbor + Royal Oak simultaneously
Businesses won't post without ROI: Free tools first, manual onboarding, "Downtime sent me" tracking
Competitors add "right now" features: Move fast, build category ownership, focus on small business love

Cost Risks

API costs exceed budget: Strict caching, free-first providers, fallback only
Scale beyond 1,000 users: Monitor per-user costs, optimize cache hit rates

Research Proposals Summary
(See /docs/research/Research_Proposals_20251007.md for full proposals)
Priority research areas for next cycle:

API Architecture Optimization - Multi-provider deduplication improvements
Caching Strategy Enhancement - Predictive cache warming for high-traffic grids
Real-time Data Accuracy - Business hours verification system
Competitive Intelligence - Monitor Yelp, Google, Meta for "now" features
Cost Optimization - OSM coverage expansion, reduce Yelp dependency
User Retention Mechanics - Push notifications, favorites, closing-soon alerts
Small Business Tools - Free flyer generator, attribution tracking


Principles for AI Agents

Stay Aligned with Mission: Every decision serves "What can I do right now?"
Prioritize Small Businesses: Solutions must be effortless for non-technical users
Validate Before Building: Test assumptions with real users
Ship Iteratively: Perfect is the enemy of done
Build Trust First: Accuracy and reliability before feature velocity
Think in Systems: Understand how user and business sides interact
Preserve Momentum: Consistent progress beats sporadic sprints

Decision Framework
Before any major decision, ask:

Does this help reach 1,000 DAUs?
Does this keep costs under $400/month?
Does this align with "right now" category ownership?
Does this serve small businesses?
Can we measure the impact?

If 3+ answers are "no," reconsider the decision.

"Ideas don't change lives. Execution does." — Roderick Harris-Wright