# Research Proposals

_Generated: 2025-10-07 (v1.1)_  
_Updated: Re-prioritized based on 7-day cache strategy_  
_Next Review: 2025-10-14_

This document contains research proposals for optimizing Downtime's technical architecture, cost structure, competitive positioning, and user experience. Each proposal includes relevance rating, expected impact, and updated priority based on the new 7-day cache strategy.

---

## 1. Multi-Provider Deduplication & Ranking Logic

**Priority**: **P0 (Immediate)**  
**Relevance**: HIGH  
**Impact**: Cost reduction + data quality improvement

### Context
Currently, Downtime uses a waterfall approach (OSM → FSQ → Yelp → Google) but doesn't have sophisticated deduplication when multiple providers return the same venue. This can lead to:
- Duplicate entries with slightly different names/addresses
- Suboptimal ranking when different providers have different data quality for the same place
- Higher API costs if we're fetching redundant data

### Research Questions
1. What's the best algorithm for fuzzy matching venue names + addresses across providers?
2. Should we prioritize Yelp data for Michigan venues but Foursquare for other regions?
3. Can we build a confidence scoring system that picks the "best version" of each venue?
4. How can we use provider disagreement (e.g., different hours) as a signal for verification needs?

### Proposed Approach
- Implement **Levenshtein distance + coordinate proximity** for deduplication
- Build **provider quality matrix** (Yelp > FSQ > Google for hours accuracy in Michigan)
- Create **"canonical record" logic** that merges best attributes from each provider
- Log provider disagreements for manual review/improvement
- **NEW**: Track provider confidence scoring over time (which source is most accurate historically per category)

### Expected Benefits
- 15-20% reduction in API calls (less redundant fetching)
- Higher data accuracy (best attributes from multiple sources)
- Foundation for future ML-based quality scoring
- Better user trust through consistently accurate data

### Resources Needed
- Study existing deduplication systems (Placekey, SafeGraph)
- Benchmark fuzzy matching libraries (fuzzywuzzy, difflib)
- Test on Detroit dataset (compare provider overlaps)

### Success Metrics
- Duplicate rate: <3% (down from current ~10-15%)
- Provider agreement rate: >90% for core attributes (name, location, hours)
- API call reduction: 15%+

**Status**: Ready to implement immediately

---

## 2. Real-Time Hours Verification System

**Priority**: **P1 (After 500 DAU)**  
**Relevance**: HIGH  
**Impact**: Data accuracy (critical for trust)

### Context
Downtime's core promise is "what can I do RIGHT NOW?" — which means hours accuracy is non-negotiable. But providers often have stale hours data (holidays, temporary closures, random changes). Industry standard: 5-15% false positive rate. Downtime target: <5%.

With the new 7-day cache policy, hours accuracy becomes even more critical since we're holding data longer. However, this should be implemented after reaching 500 DAU when we have enough user feedback to validate the need.

### Research Questions
1. What's our current false positive rate? (Need to measure)
2. How can we crowdsource corrections efficiently?
3. Should we build a partnership with businesses for "live status" API?
4. Can we use social media activity (Instagram stories, FB posts) as a signal?
5. With 7-day cache, how often do hours actually change for typical venues?

### Proposed Approach
- **Phase 1** (After 500 DAU): Implement user reporting system
  - "This place is closed" button
  - Track reporter accuracy to prevent abuse
  - Manual verification for flagged venues
- **Phase 2** (After 1,000 DAU): Build partnership program
  - Simple API for businesses to update their status
  - "Powered by Downtime" badge for participating venues
  - QR code system for instant updates
- **Phase 3** (Future): Social media signals
  - Monitor Instagram story timestamps
  - Facebook "Open Now" status scraping
  - Review mentions of "currently closed"

### Expected Benefits
- False positive rate: 5-15% → <5%
- Increased user trust and retention
- Competitive differentiation (most accurate hours data)
- Stronger business relationships

### Cost Estimate
- User reporting: ~$0 (built into app)
- Business API: ~$20/month (simple webhook system)
- Social scraping: ~$50-100/month (if needed)

### Success Metrics
- User reports per 1,000 sessions: <10 (low error rate)
- Business adoption: 20% of listed venues using API (after 6 months)
- Verified accuracy: >95% for participating businesses

**Status**: Keep on deck, implement after DAU > 500

---

## 3. Competitive Intelligence Monitoring

**Priority**: **P1 (Ongoing)**  
**Relevance**: EXTREMELY HIGH  
**Impact**: Strategic positioning & feature prioritization

### Context
Downtime operates in the "local discovery" space dominated by Google, Yelp, and Meta. If any incumbent adds robust "right now" features, it could threaten Downtime's category ownership. Continuous monitoring is essential to:
- Identify threats early
- Spot partnership opportunities
- Find gaps competitors are ignoring
- Track data source changes (API pricing, new providers)

### Research Questions
1. Has Google added any "open now" or "happening now" features to Maps?
2. Has Yelp improved their "Open Now" filter accuracy?
3. Has Meta (Facebook/Instagram) launched local discovery features?
4. Are any new startups targeting the "spontaneous discovery" category?
5. Have major APIs changed pricing or terms (Foursquare, Yelp, Google)?

### Proposed Approach
- **Monthly Competitor Review** (assign to Claude Research role):
  - Product releases (Google Maps, Yelp, Meta)
  - New features (especially "now" related)
  - Data partnerships announced
  - API pricing changes
- **Weekly News Monitoring**:
  - Local discovery startup funding
  - Tech blog coverage of "real-time" features
  - Industry reports on location-based services
- **Quarterly Deep Dive**:
  - User experience audits of competitor apps
  - Feature comparison matrix
  - Identify strategic gaps

### Expected Benefits
- Early warning system for competitive threats
- Insight into partnership opportunities
- Feature prioritization based on market gaps
- Awareness of cost structure changes

### Cost Estimate
- ~2-3 hours per month (automated + human review)
- $0 direct costs (uses existing research tools)

### Success Metrics
- Zero competitive surprises (early awareness of all major launches)
- Identified 3+ strategic gaps per quarter
- Feature roadmap adjustments based on findings

**Status**: Implement immediately, assign to recurring monthly task

---

## 4. Small Business Tools (Revenue Expansion)

**Priority**: **P2 (After Monetization Readiness)**  
**Relevance**: HIGH  
**Impact**: Revenue generation + business engagement

### Context
Downtime's long-term monetization depends on providing value to small businesses beyond free discovery. The Chief of Staff correctly identified this as "perfect for revenue expansion" — free tools leading to paid tiers.

**MVP Focus**: Flyer Generator + Attribution Dashboard (test adoption before expanding)

### Proposed Tools

#### **4a. Flyer Generator (P2 - MVP)**
- Simple template builder for "What's Happening Now" posts
- Auto-generates QR codes linking to Downtime listing
- Free tier: 3 designs, basic analytics
- Paid tier ($9/month): Unlimited designs, A/B testing, advanced analytics

#### **4b. Attribution Dashboard (P2 - MVP)**
- Track how many people found business via Downtime
- "Downtime sent me" tracking (QR scans, app opens)
- Free tier: Basic stats (views, QR scans)
- Paid tier ($19/month): Full analytics, conversion tracking, ROI reports

#### **4c. Scheduler (P3 - Post-MVP)**
- Schedule posts for future events (happy hour, live music, etc.)
- Free tier: 5 scheduled posts/month
- Paid tier ($14/month): Unlimited posts, recurring events, reminders

#### **4d. POS Integration (P3 - Future)**
- Automatically post when happy hour starts, lunch specials, etc.
- Requires partnerships with Square, Toast, Clover
- Likely $29-49/month tier

### Research Questions
1. What % of businesses would pay for flyer tools?
2. What price point maximizes adoption without leaving money on table?
3. Which attribution metrics matter most to small business owners?
4. Can we partner with existing POS systems instead of building integrations?

### Proposed Approach
- **Phase 1**: Launch free Flyer Generator to 50 beta businesses
- **Phase 2**: Add Attribution Dashboard, measure engagement
- **Phase 3**: Introduce paid tiers after proving ROI
- **Phase 4**: Expand to Scheduler and POS integration based on demand

### Expected Benefits
- New revenue stream (target: $50-200 MRR after 6 months)
- Increased business engagement (more frequent posts)
- Stronger retention (businesses invested in platform)
- Competitive differentiation (only "now" platform with business tools)

### Success Metrics
- Free tool adoption: 30% of listed businesses (after 3 months)
- Paid conversion: 10% of active business users
- Average revenue per business: $15-25/month

**Status**: Build after reaching 1,000 DAU and validating business engagement

---

## 5. OSM Coverage Expansion

**Priority**: **P3 (Cost Optimization)**  
**Relevance**: MEDIUM  
**Impact**: Long-term cost reduction

### Context
OpenStreetMap is completely free and has excellent coverage for parks, trails, and public spaces. Expanding OSM usage reduces reliance on paid providers (Yelp, Google). With the 7-day cache policy already reducing API costs by 85%, OSM expansion becomes a lower priority but remains valuable for long-term sustainability.

### Research Questions
1. What categories have good OSM coverage vs poor coverage?
2. Can we supplement OSM with crowdsourced data (users adding missing places)?
3. How accurate is OSM data for business hours?
4. Can we build a hybrid approach (OSM for location, Yelp for hours)?

### Proposed Approach
- Audit OSM coverage by category (parks, cafes, shops, etc.)
- Identify categories where OSM can fully replace paid providers
- Build data quality scoring system (OSM vs FSQ vs Yelp)
- Gradually shift traffic to OSM where quality is comparable

### Expected Benefits
- 10-15% additional cost reduction (beyond 7-day cache savings)
- Less vendor lock-in
- Community-driven data improvements

### Cost Estimate
- $0 API costs (OSM is free)
- ~1 week engineering time for hybrid logic

### Success Metrics
- OSM usage: 20% of total API calls (from current ~5%)
- Data quality maintained (false positive rate unchanged)

**Status**: Low priority, defer until after 1,000 DAU

---

## 6. Weekly Grid Refresh System (Replaces Predictive Cache Warming)

**Priority**: **P3 (Optimization)**  
**Relevance**: MEDIUM  
**Impact**: Cache hit rate improvement + cost optimization

### Context
**REVISED from original Predictive Cache Warming proposal.**

The original proposal suggested pre-warming popular grids during off-peak hours with a 15-minute cache. With the new 7-day cache policy, this approach is unnecessary for short-term growth. Instead, a **weekly grid refresh** for high-traffic areas is more aligned with cost-first thinking.

### Research Questions
1. Which grids have the highest repeat request rates?
2. What time of day sees the most traffic per grid?
3. After 7 days, which cached grids are still being requested?
4. What's the cost vs benefit of refreshing top 20-50 grids weekly?

### Proposed Approach
- Analyze `request_logs` to identify top 50 most-requested grids
- Build time-series model for traffic patterns (e.g., downtown lunch rush Mon-Fri 11am-1pm)
- Schedule **weekly refresh jobs** via cron for top grids only
- Monitor cache hit rate and API cost impact

### Expected Benefits
- Ensure popular areas always have fresh data (within 7 days)
- Minimal additional API costs (~300 calls/week = $5-10/month)
- Better user experience for high-traffic zones

### Cost Estimate
- ~50 grids × 6 categories × 1 API call/week = ~300 calls/week
- At current Yelp rate: $0 (flat rate covers this)
- At scale with Google fallback: ~$20-30/month

### Success Metrics
- Cache hit rate for top 50 grids: 90%+ (high-traffic areas never stale)
- User complaints about stale data: <1% of sessions

**Status**: Implement after 500 DAU, once traffic patterns are clear

---

## 7. User Retention Mechanics

**Priority**: **P3 (Growth Optimization)**  
**Relevance**: MEDIUM  
**Impact**: D7/D30 retention improvement

### Context
Getting users to return is critical for sustainable growth. Retention mechanics can encourage repeat usage without being spammy.

### Proposed Features
- **Push Notifications** (after user opts in):
  - "3 new places near you opened today"
  - "Your favorite coffee shop is closing in 30 minutes"
- **Favorites System**:
  - Save favorite places
  - Get alerts when they post something new
- **Closing Soon Alerts**:
  - "Don't miss out - closes at 6pm today"
- **Neighborhood Digest**:
  - Weekly email of "What's New in Your Area"

### Expected Benefits
- D7 retention: 20% → 35%
- D30 retention: 10% → 20%
- Sessions per user: 1.5 → 2.5

### Cost Estimate
- Push notifications: ~$10-20/month (OneSignal or similar)
- Email: ~$10-20/month (SendGrid free tier likely sufficient)

**Status**: Implement after validating product-market fit (1,000 DAU milestone)

---

## Priority Summary (Updated for v1.1)

| Priority | Proposal | When to Implement | Impact |
|----------|----------|-------------------|--------|
| **P0** | Multi-Provider Deduplication | Immediately | Cost + Quality |
| **P1** | Real-Time Hours Verification | After 500 DAU | Trust + Accuracy |
| **P1** | Competitive Intelligence | Ongoing (Monthly) | Strategy |
| **P2** | Small Business Tools | After Monetization Readiness | Revenue |
| **P3** | OSM Coverage Expansion | After 1,000 DAU | Cost Reduction |
| **P3** | Weekly Grid Refresh | After 500 DAU | UX Optimization |
| **P3** | User Retention Mechanics | After 1,000 DAU | Growth |

---

## Key Changes from v1.0

1. **Predictive Cache Warming** downgraded from P0 to P3 and reframed as "Weekly Grid Refresh"
   - 7-day cache makes aggressive pre-warming unnecessary
   - Weekly refresh for popular grids is more cost-effective
2. **Real-Time Hours Verification** moved to P1 with clearer DAU threshold (500+)
   - 7-day cache makes hours accuracy more critical
   - Crowdsourced validation model recommended
3. **Competitive Intelligence** elevated to P1
   - Monthly monitoring is "extremely valuable" per Chief of Staff
   - Assign to recurring Claude Research task
4. **Small Business Tools** focused on MVP subset (Flyer + Attribution)
   - Test adoption before building Scheduler or POS integration
   - Clear revenue expansion path

---

_This document is living documentation. Updates tracked in /docs/context/Change_Log.md_