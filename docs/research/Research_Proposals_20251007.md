# Research Proposals

_Generated: 2025-10-07_  
_Next Review: 2025-10-14_

This document contains research proposals for optimizing Downtime's technical architecture, cost structure, competitive positioning, and user experience. Each proposal includes relevance rating and expected impact.

---

## 1. Multi-Provider Deduplication & Ranking Logic

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
- Implement Levenshtein distance + coordinate proximity for deduplication
- Build provider quality matrix (Yelp > FSQ > Google for hours accuracy in Michigan)
- Create "canonical record" logic that merges best attributes from each provider
- Log provider disagreements for manual review/improvement

### Expected Benefits
- 15-20% reduction in API calls (less redundant fetching)
- Higher data accuracy (best attributes from multiple sources)
- Foundation for future ML-based quality scoring

### Resources Needed
- Study existing deduplication systems (Placekey, SafeGraph)
- Benchmark fuzzy matching libraries (fuzzywuzzy, difflib)
- Test on Detroit dataset (compare provider overlaps)

---

## 2. Predictive Cache Warming

**Relevance**: HIGH  
**Impact**: Faster UX + cost optimization

### Context
Current caching is reactive (cache-on-demand). Popular grids get requested frequently, but the first user always hits a cold cache. For high-traffic areas (downtown Detroit, Ann Arbor campus, etc.), we could pre-warm the cache during off-peak hours.

### Research Questions
1. Which grids have the highest repeat request rates?
2. What time of day sees the most traffic per grid?
3. Can we predict "about to be popular" grids (e.g., near events, rush hours)?
4. What's the cost vs benefit of pre-warming 20-50 popular grids daily?

### Proposed Approach
- Analyze `request_logs` to identify top 50 most-requested grids
- Build time-series model for traffic patterns (e.g., downtown lunch rush Mon-Fri 11am-1pm)
- Schedule cache warming jobs via cron (off-peak: 3-5am)
- Monitor cache hit rate improvement

### Expected Benefits
- 80%+ cache hit rate for popular areas (vs current ~50-60%)
- Faster perceived load times for majority of users
- Reduced API costs during peak hours

### Cost Estimate
- ~50 grids × 6 categories × 1 API call = 300 calls/day
- At current Yelp rate: $0 (flat rate covers this)
- At scale with Google fallback: ~$15-30/month extra

### Success Metrics
- Cache hit rate for top 50 grids: 70% → 85%
- P95 response time: 800ms → 300ms

---

## 3. Real-Time Hours Verification System

**Relevance**: MEDIUM-HIGH  
**Impact**: Data accuracy (critical for trust)

### Context
Downtime's core promise is "what can I do RIGHT NOW?" — which means hours accuracy is non-negotiable. But providers often have stale hours data (holidays, temporary closures, random changes). Industry standard: 5-15% false positive rate. Downtime target: <5%.

### Research Questions
1. What's our current false positive rate? (Need to measure)
2. How can we crowdsource corrections efficiently?
3. Should we build a partnership with businesses for "live status" API?
4. Can we use social media activity (Instagram stories, FB posts) as a signal?

### Proposed Approach
**Phase 1: Measurement**
- Build "Report Closed" button in UI
- Track false positive rate per provider (Yelp vs FSQ vs Google)
- Identify high-churn venues (restaurants that change hours frequently)

**Phase 2: Multi-Source Verification**
- Cross-reference hours from Yelp + Google + Foursquare
- Flag disagreements for manual verification
- Prioritize venues with high traffic (>10 requests/week)

**Phase 3: Business Integration**
- Build simple "Update Hours" tool for businesses
- Offer free QR code in exchange for hour updates
- Direct API for businesses to push live status

**Phase 4: Social Signal Integration** (Future)
- Monitor Instagram story timestamps near venue locations
- Check Google My Business "live busy times"
- Use crowd signals as confidence modifiers

### Expected Benefits
- False positive rate: 10% → <5%
- User trust increases (fewer "this place is closed" complaints)
- Business engagement (free tool → relationship building)

### Implementation Complexity
- Phase 1-2: LOW (1-2 weeks)
- Phase 3: MEDIUM (4-6 weeks + business outreach)
- Phase 4: HIGH (3+ months, ML/NLP work)

---

## 4. Competitive Intelligence Monitoring

**Relevance**: HIGH  
**Impact**: Strategic positioning

### Context
Downtime's advantage is category ownership ("right now"), but incumbents could add this feature overnight. Google already has "open now" filters. Yelp could add time-sensitive feeds. We need continuous monitoring.

### Entities to Monitor
**Primary Threats**:
- Google Maps (new features, "open now" UI changes)
- Yelp (live waiting times, time-sensitive promotions)
- Meta/Facebook (local discovery, events "happening now")
- Apple Maps (underrated competitor, tight iOS integration)

**Secondary Threats**:
- EventBrite (spontaneous event discovery)
- Uber Eats (restaurant availability)
- Rover/BringFido (dog-friendly, but not "now")

### Research Cadence
**Weekly**: Check product updates, new feature releases  
**Monthly**: Analyze UI changes, new partnerships, API updates  
**Quarterly**: Conduct feature parity analysis, user migration risk assessment

### Key Questions
1. Has any competitor shipped a "right now" feed in the past 30 days?
2. Are businesses asking for integrations with other "now" platforms?
3. What's the time-to-copy for our core features? (1 month? 6 months?)
4. Where can Downtime differentiate beyond "real-time"?

### Defensive Moats to Build
- **Data moat**: Proprietary verified "right now" dataset
- **Business relationships**: Direct integrations with Detroit businesses
- **Community**: Active user base that trusts Downtime > algorithms
- **Niche ownership**: "Dog-friendly right now" → families → specific verticals
- **Speed**: Ship features in days, not quarters

### Action Items
- Set up Google Alerts for competitor product updates
- Monthly competitive feature matrix (Downtime vs Yelp vs Google)
- Quarterly user survey: "What would make you switch to Yelp/Google?"

---

## 5. Cost Optimization Through OSM Expansion

**Relevance**: MEDIUM  
**Impact**: ~10-15% cost reduction potential

### Context
OpenStreetMap is 100% free but has less business data (hours, phone, reviews). For **parks and public spaces**, OSM is excellent. We should maximize OSM usage before hitting paid APIs.

### Research Questions
1. What % of our requests are for categories where OSM excels (parks, landmarks, outdoor recreation)?
2. Can we build a hybrid system: OSM for basic info + Yelp enrichment only when needed?
3. How accurate is OSM data for Detroit/Michigan specifically?
4. Can we contribute back to OSM (user-submitted corrections)?

### Proposed Approach
**Audit Current Coverage**:
- Analyze request logs: % of queries for parks/outdoors
- Test OSM coverage in Detroit (parks, trails, public spaces)
- Compare OSM vs Google Places for public venues

**Expand OSM Usage**:
- Use OSM as primary for: parks, trails, beaches, public landmarks
- Fallback to Yelp only for: hours verification, reviews, amenities
- Skip Google entirely for park categories

**Data Quality Checks**:
- Cross-reference OSM with city park databases
- Flag missing/outdated OSM data for manual correction
- Build OSM contribution pipeline (users can suggest edits)

### Expected Savings
- Current: ~30% of requests are parks/outdoors
- If OSM handles 80% of parks queries → saves ~24% of Yelp calls
- Estimated monthly savings: $50-75 (or more at scale)

### Implementation Effort
- LOW-MEDIUM: 2-3 weeks to integrate OSM Overpass API
- Existing: Already have geocoding/normalization logic
- Risk: OSM data quality varies by region (need testing)

---

## 6. User Retention Mechanics Research

**Relevance**: HIGH  
**Impact**: D7 retention rate, DAU growth

### Context
Current product is "pull-based" (user opens app when bored). To increase retention, we need "push-based" triggers (notifications, alerts, reminders) that bring users back.

### Retention Levers to Research

**1. Push Notifications**
- "3 new places opened this week near you"
- "Your favorite spot is closing in 45 minutes"
- "Dog-friendly happy hour happening now at [venue]"

**2. Favorites & Tracking**
- Let users save favorite venues
- Alert when favorites post new "now" events
- "You haven't been to [saved spot] in 2 weeks"

**3. Closing Soon Alerts**
- Notify 45-60min before a place closes
- "Last call" for restaurants/bars
- Creates urgency, drives spontaneous action

**4. Daily/Weekly Digest**
- "What's happening this weekend in Detroit"
- Personalized based on past views/favorites
- Email or push notification

**5. Social Features** (Future)
- Friend activity feed ("Your friend just checked in at...")
- Group planning ("3 of your friends favorited this spot")
- Challenge/gamification ("Visit 5 new parks this month")

### Research Questions
1. What's the optimal notification frequency? (Daily? Weekly? Event-driven only?)
2. Which notification type drives highest re-engagement?
3. Do push notifications improve D7 retention? (Need A/B test)
4. What % of users opt-in to notifications?

### Testing Approach
- Start with email digests (lower friction, no permissions needed)
- A/B test frequency: 1x/week vs 2x/week vs event-driven
- Measure: Open rate, click-through, DAU lift
- Phase 2: Add push notifications for high-intent users

### Success Metrics
- D7 retention: 40% → 55%
- Notification CTR: >15%
- Unsubscribe rate: <2%

---

## 7. Small Business Tool Suite Research

**Relevance**: MEDIUM-HIGH  
**Impact**: Business adoption, monetization path

### Context
Downtime's long-term monetization relies on providing value to businesses. Free tools → paid premium features → marketplace revenue. Need to research what tools small businesses actually want and will use.

### Tool Ideas to Research

**1. Free Flyer Generator** (MVP)
- 5-minute tool to create Instagram story for "now" events
- Pre-designed templates (happy hour, live music, dog-friendly)
- Auto-includes Downtime QR code for attribution

**2. Attribution Dashboard** (Future)
- Show businesses: "X people saw your event on Downtime"
- Track QR code scans, directions clicks, website visits
- Proof of ROI for future premium upsell

**3. Posting Scheduler** (Premium)
- Schedule "now" events in advance
- Recurring posts (e.g., every Tuesday happy hour)
- Multi-platform (Instagram, Facebook, Downtime)

**4. Insights & Analytics** (Premium)
- Foot traffic trends
- Best performing event types
- Competitive intel (how your "now" posts compare to others)

**5. POS Integration** (Future)
- Auto-post based on slow periods (empty tables → post "seats available now")
- Integration with Toast, Square, Clover
- Real-time capacity signals

### Research Questions
1. What tools do Detroit small businesses currently use for marketing?
2. What's the average marketing budget for SMBs in our target market?
3. Would businesses pay $29-99/month for scheduling + analytics?
4. What's the friction to getting businesses to post 3x/week?

### Discovery Approach
- Interview 20 Detroit businesses (mix of current Doggo Now partners + new)
- Competitive research: What do Yelp, Google, Meta offer for SMBs?
- Survey 50 businesses: "What marketing tools do you wish existed?"
- Prototype flyer generator MVP, test with 10 businesses

### Success Metrics
- Business adoption: 100 active by Month 6
- Avg posts per business per week: 3+
- Free-to-paid conversion: 10-15% within 6 months
- "Downtime sent me" attribution: measurable within 3 months

---

## Summary Table

| # | Proposal | Relevance | Impact | Effort | Priority |
|---|----------|-----------|--------|--------|----------|
| 1 | Multi-Provider Deduplication | HIGH | Cost + Quality | MEDIUM | **P0** |
| 2 | Predictive Cache Warming | HIGH | Speed + Cost | LOW | **P0** |
| 3 | Hours Verification System | MED-HIGH | Trust | LOW-MED | **P1** |
| 4 | Competitive Intelligence | HIGH | Strategy | LOW | **P0** |
| 5 | OSM Expansion | MEDIUM | Cost | LOW-MED | **P2** |
| 6 | Retention Mechanics | HIGH | Growth | MEDIUM | **P1** |
| 7 | Small Business Tools | MED-HIGH | Revenue | HIGH | **P2** |

### Recommended Next Actions
1. **Immediate (Week 1-2)**: Start competitive monitoring (#4) and cache analysis (#2)
2. **Short-term (Month 1)**: Implement deduplication improvements (#1) and hours reporting (#3)
3. **Medium-term (Month 2-3)**: Test retention features (#6) and OSM expansion (#5)
4. **Long-term (Month 4+)**: Build business tools (#7) after reaching 500+ DAUs

---

_These proposals will be refined each cycle based on user feedback, cost data, and competitive landscape changes._