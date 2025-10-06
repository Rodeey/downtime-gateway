# Downtime System Context

_Last synced: 2025-10-07 (v1.1)_  
_Major change: Cache TTL extended to 7 days_

## Mission & Vision

**Mission**: Democratize local discovery by connecting people with real-time experiences and empowering small businesses with effortless marketing.

**Core Question**: "What can I do right now?"

**Vision**: Own the "Right Now" category — becoming the definitive answer to spontaneous discovery, not tomorrow or next week, but this moment.

### Founder Principles
- **Strategy First**: Opportunity cost, roadmap, document, align before action
- **Lean Startup**: Test assumptions, iterate based on feedback
- **Execution Over Ideas**: Ideas don't change lives, execution does
- **Cost-First Thinking**: Every feature must consider API costs
- **Measure Ruthlessly**: Track metrics, adjust based on data

---

## Current Architecture Overview

### Tech Stack
- **Frontend**: Next.js (Pages Router), React, Tailwind CSS
- **Backend**: Zuplo API Gateway (custom serverless orchestration)
- **Database**: Supabase (PostgreSQL)
- **Caching**: Supabase + in-memory (**7-day grid-based cache**)
- **Analytics**: PostHog
- **Hosting**: Vercel

### Repository Structure
1. **downtime** - Main Next.js user-facing application
2. **downtime-gateway** - New API gateway for cost-optimized data orchestration

---

## Backend Data Flow

### Request Pipeline (High-Level)
```
1. User Opens App
   ↓
2. Check Supabase Cache (7-day freshness per 1km² grid × category × 2h bucket)
   ↓
3. If Fresh (< 7 days old): Return cached results immediately
   If Stale (> 7 days old): Call API Gateway
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
7. Store in Supabase Cache with expires_at = created_at + interval '7 days'
   ↓
8. Return to User
```

### Cache Strategy (v1.1 - UPDATED)

**Policy**: 7-day TTL for all cached_places entries

**Refresh Rules**:
- **Default**: Cache is valid for 7 days after creation
- **Force refresh** only if:
  - Place record is missing entirely
  - Category definition changes (new subcategories added)
  - Venue has explicit evidence of closure (manual flag or external provider signal)

**Rationale**:
- Static data (parks, landmarks, established businesses) rarely changes
- Dramatically reduces API calls on redundant requests
- Aligns with cost-first strategy: minimize paid API usage until monetized
- Predictable monthly costs while building user traction

**Future Enhancement**:
- After reaching 500+ DAU, implement weekly "high-traffic grid refresh" via cron
- Only pre-warm top 20-50 most-requested grids during off-peak hours
- Current 7-day policy keeps costs minimal during growth phase

---

## Frontend-Backend Contract

### Endpoint: `/places`

**Request**:
```typescript
{
  lat: number;        // Required: -90 to 90
  lng: number;        // Required: -180 to 180
  radius: number;     // Optional: default 2500m, max 5000m
  categories: string[]; // Optional: ['food', 'parks', 'shops', etc.]
  open_now: boolean;  // Optional: filter by current hours
}
```

**Response**:
```typescript
{
  places: Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
    address: string;
    category: string;
    open_now: boolean | null;
    distance: number;  // meters from user
    hours?: string;    // e.g., "11am-9pm"
    phone?: string;
    rating?: number;
    provider: 'osm' | 'foursquare' | 'yelp' | 'google';
  }>;
  cached: boolean;     // true if from 7-day cache
  cache_age: number;   // hours since cache creation
}
```

---

## Provider Logic & Cost Strategy

### Provider Waterfall (Priority Order)

**1. OpenStreetMap (OSM)** - FREE
- **Use for**: Parks, hiking trails, public spaces
- **Limitations**: Limited business hours, no ratings
- **Coverage**: Excellent for outdoors, weak for businesses

**2. Foursquare** - FREE (99,000 calls/month)
- **Use for**: Food & Drink, Shops, Activities
- **Strengths**: Good hours data, reliable coordinates
- **Limitations**: Less detailed than Yelp for Michigan venues

**3. Yelp Fusion API** - $299/month (flat rate)
- **Use for**: Michigan venues requiring detailed business data
- **Strengths**: Best hours accuracy, ratings, photos
- **Limitations**: Flat monthly cost (optimize with 7-day cache)

**4. Google Places API** - PAY-PER-CALL (expensive)
- **Use for**: FALLBACK ONLY when others fail
- **Cost**: ~$17 per 1,000 calls (Basic Data) to $32 (Contact/Atmosphere)
- **Strategy**: Avoid unless absolutely necessary

### Category-to-Provider Mapping

| Category | Primary | Fallback 1 | Fallback 2 |
|----------|---------|------------|------------|
| Food & Drink | Foursquare | Yelp | Google |
| Parks & Outdoors | OSM | Foursquare | Google |
| Shops & Errands | Foursquare | Yelp | Google |
| Arts & Culture | Foursquare | Yelp | Google |
| Coffee & WFH | Foursquare | Yelp | Google |
| Activities & Fun | Foursquare | Yelp | Google |

---

## API & Cache Rules

### Cache Configuration (v1.1 - UPDATED)

**Table**: `cached_places`

**Schema**:
```sql
CREATE TABLE cached_places (
  id UUID PRIMARY KEY,
  grid_id TEXT NOT NULL,        -- H3 hex or lat_lng_bucket
  category TEXT NOT NULL,
  hour_bucket INT NOT NULL,     -- 0-11 (2-hour increments)
  raw_json JSONB NOT NULL,      -- Raw provider response
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + interval '7 days',  -- NEW: 7-day TTL
  provider TEXT NOT NULL         -- 'osm', 'fsq', 'yelp', 'google'
);

CREATE INDEX idx_cache_lookup 
ON cached_places (grid_id, category, hour_bucket, expires_at);
```

**Cache Lookup Logic**:
```typescript
// Check if cache is still valid (< 7 days old)
const cached = await supabase
  .from('cached_places')
  .select('*')
  .eq('grid_id', gridId)
  .eq('category', category)
  .eq('hour_bucket', hourBucket)
  .gt('expires_at', new Date().toISOString())  // Still fresh?
  .single();

if (cached) {
  return cached.raw_json;  // Return cached data
} else {
  // Fetch from providers, update cache with new 7-day expiry
}
```

### Category Thresholds (Michigan MVP)

| Category | Min Results | Max Results (Cap) |
|----------|-------------|-------------------|
| Food & Drink | 50 | 50 |
| Parks & Outdoors | 40 | 40 |
| Shops & Errands | 35 | 35 |
| Arts & Culture | 25 | 25 |
| Activities & Fun | 30 | 30 |
| Coffee & WFH | 20 | 20 |
| **Total per request** | - | **200** |

**Rules**:
- If cached results < minimum threshold → fetch from providers
- Apply caps to prevent frontend overload
- Always prioritize `open_now: true` results if requested

---

## Cost Projections (Updated for 7-Day Cache)

### Monthly Cost at 1,000 DAUs

**Assumptions**:
- 1,000 daily active users
- 3 searches per user per session
- 7-day cache reduces fresh API calls by ~85% (vs 15-minute cache ~50%)

**Estimated Breakdown**:
- **Yelp**: $299/month (flat rate) ✅
- **Foursquare**: $0 (free tier covers 99k calls) ✅
- **Google**: ~$20-40/month (fallback only, minimal usage)
- **Supabase**: ~$25/month (database + storage)
- **Hosting**: $20/month (Vercel Pro)

**Total**: **$365-385/month** (within $400 budget ✅)

**Cache Hit Rate Projection**:
- With 15-minute cache: ~50-60% hit rate
- With 7-day cache: **~85-90% hit rate** (static data remains fresh longer)

---

## Current Development Status

### Phase 0 (October 2025): Cost Optimization

**Completed**:
- ✅ Next.js frontend with map view
- ✅ Supabase database schema
- ✅ Provider waterfall logic (OSM → FSQ → Yelp → Google)
- ✅ Category filtering system
- ✅ Basic cache implementation

**In Progress**:
- 🔄 Deploying downtime-gateway
- 🔄 PostHog analytics integration
- 🔄 Request logging to Supabase
- 🔄 **Extending cache TTL to 7 days** (v1.1 update)

**Next Steps**:
1. Update supabase.ts → change `expires_at` to `created_at + interval '7 days'`
2. Load test with 1,000 simulated users
3. Measure cache hit rate improvement (target: 85%+)
4. Document actual API costs per endpoint
5. Fix any performance issues

---

## Roadmap

**Phase 0 (Month 1)**: Launch-Ready Backend
- Deploy downtime-gateway
- Implement 7-day cache policy
- Add PostHog analytics
- Load testing
- Target: Cost < $400/month at 1,000 DAUs

**Phase 1 (Month 2)**: Soft Launch
- Friends & family (50 users)
- Detroit subreddit marketing
- TikTok content creation
- 10 business partnerships
- QR codes at 5 venues
- Target: 100-200 DAUs

**Phase 2 (Month 3-4)**: Growth
- Product Hunt launch
- Detroit press outreach
- Influencer partnerships
- Scale to 500 DAUs
- Measure retention and iterate

---

## Key Metrics

**User Metrics**:
- DAU, WAU, MAU
- D1/D7/D30 return rate
- Session length
- Searches per session

**Business Metrics**:
- Active business partners
- Posts/week
- QR code scans
- Conversion rates

**Platform Metrics**:
- Fresh items per neighborhood
- Data accuracy (<5% false positives)
- Cache hit rate (target: 85%+)

**Financial Metrics**:
- Monthly burn rate
- API costs per user
- Cost per acquisition (CAC)
- Lifetime value (LTV)

---

## Known Risks & Mitigations

### Technical Risks

**Risk**: Empty cache on first load in new areas  
**Mitigation**: Pre-warm cache for Detroit core (after 500 DAU), accept slower first load for new regions

**Risk**: API rate limits during traffic spikes  
**Mitigation**: Queue system with exponential backoff, 7-day cache prevents most spikes

**Risk**: Stale data (business closed, hours changed)  
**Mitigation**: User reporting system, manual verification for flagged venues, 7-day refresh cycle

### Business Risks

**Risk**: Can't reach 1,000 DAUs with Detroit alone  
**Mitigation**: Expand to Ann Arbor + Royal Oak simultaneously

**Risk**: Businesses won't post without immediate ROI  
**Mitigation**: Free tools first (flyer generator), manual onboarding, attribution tracking

**Risk**: Competitors add "right now" features  
**Mitigation**: Move fast, own category, focus on small business love

### Cost Risks

**Risk**: API costs exceed $400/month budget  
**Mitigation**: 7-day cache, strict provider waterfall, monitor per-user costs

**Risk**: Scale beyond 1,000 users without revenue  
**Mitigation**: Optimize cache hit rate (85%+), expand free-first providers (OSM)

---

## Research Proposals Summary

_(See /docs/research/Research_Proposals_20251007_v1_1.md for full updated proposals)_

**Priority research areas for next cycle:**

**P0 (Immediate)**:
1. Multi-Provider Deduplication & Ranking Logic

**P1 (After 500 DAU)**:
2. Real-Time Hours Verification System
3. Competitive Intelligence Monitoring

**P2 (Revenue Phase)**:
4. Small Business Tools (Flyer Generator + Attribution Dashboard)

**P3 (Optimization)**:
5. OSM Coverage Expansion
6. Weekly Grid Refresh System (replaces Predictive Cache Warming)
7. User Retention Mechanics

---

## Principles for AI Agents

1. **Stay Aligned with Mission**: Every decision serves "What can I do right now?"
2. **Prioritize Small Businesses**: Solutions must be effortless for non-technical users
3. **Validate Before Building**: Test assumptions with real users
4. **Ship Iteratively**: Perfect is the enemy of done
5. **Build Trust First**: Accuracy and reliability before feature velocity
6. **Think in Systems**: Understand how user and business sides interact
7. **Preserve Momentum**: Consistent progress beats sporadic sprints
8. **Cost-First Always**: Every feature must justify its API cost impact

---

## Decision Framework

Before any major decision, ask:

1. Does this help reach 1,000 DAUs?
2. Does this keep costs under $400/month?
3. Does this improve data accuracy or user trust?
4. Can we test this without building everything?
5. What's the opportunity cost vs alternatives?

**If 3+ answers are "yes" → proceed.**  
**If 2 or fewer → revisit or defer.**

---

_This document is living documentation. Updates tracked in /docs/context/Change_Log.md_