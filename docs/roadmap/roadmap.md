_Last updated: 2025-10-07 (v1.0)_

# Downtime Roadmap (Q4 2025)

## Mission
Downtime redefines local discovery by automating real-time marketing for small businesses.  
Our focus this quarter: launch the first live version of the platform, validate value with Detroit businesses, and position for accelerator funding.

---

## Core Objectives
- [ ] Launch MVP with fully integrated Zuplo backend
- [ ] Acquire 1 paying host (business customer)
- [ ] Achieve 1,000 active user sessions
- [ ] Secure placement in an accelerator or early-stage fund
- [ ] Transition to full-time Downtime operations

---

## Milestones

### 🔧 Phase 1 – Integration (October)
- [x] Frontend & Zuplo repos connected
- [x] Build Codex prompt + safety workflow
- [ ] Generate `/docs/context` summaries via Claude
- [ ] Run Codex integration task → open PRs
- [ ] Review & merge PRs after local tests
- [ ] Deploy new build to Vercel

### 🚀 Phase 2 – MVP Launch (November)
- [ ] Implement dynamic category filters
- [ ] Validate “Closing Soon” logic in production
- [ ] Add analytics (PostHog funnels)
- [ ] Run Detroit soft launch campaign
- [ ] Collect 10 business feedback sessions

### 💰 Phase 3 – Growth & Funding (December)
- [ ] Refine pitch deck and metrics
- [ ] Apply to YC Winter 2026 or local accelerators
- [ ] Build internal analytics dashboard for host adoption
- [ ] Prepare for next-city expansion (Austin or Miami)

---

## Metrics of Success
| Category | Target | Status |
|-----------|---------|--------|
| Active businesses | 5 | ⏳ |
| Daily user sessions | 1,000 | ⏳ |
| Conversion rate (host signup) | 10% | ⏳ |
| Deployment uptime | 99% | ✅ |
| Cost per host acquisition | <$20 | ⏳ |

---

## Dependencies
- Vercel (Frontend)
- Zuplo Gateway (Backend)
- Supabase (Cache & Logs)
- Foursquare / Yelp APIs
- PostHog Analytics

---

## Notes
All integration and automation tasks run through Codex using the safety prompt block.  
Claude supports summarization and documentation generation.  
GPT-5 serves as the strategic coordinator.

---

### AI Roles
- GPT-5: Strategic coordination, roadmap updates, and prompt design.
- Claude: Summarization and documentation generation.
- Codex: Execution, repo management, and PR automation.
