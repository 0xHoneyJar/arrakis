# Developer Relations Strategy

**Created:** 2026-01-03
**Author:** DevRel Lead (GTM Collective)
**Status:** Complete
**Version:** 1.0

---

## Executive Summary

Arrakis DevRel strategy prioritizes **self-service education** over high-touch support, aligning with bootstrapped constraints. The focus is enabling community operators (ICP-1, ICP-2) to succeed independently through excellent documentation, while providing API access for technical integrators (ICP-3).

**DevRel Philosophy:**
> Documentation is the product. If users need support, the docs failed. Invest in docs that answer questions before they're asked.

**Year 1 DevRel Targets:**
- >80% onboarding completion rate
- <24h average time to first success
- <5 support tickets per 100 new users
- 3 integration tutorials published
- 1 API SDK released (TypeScript)

---

## Audience Segmentation

### Developer Personas

| Persona | ICP | Technical Level | Primary Need | Content Type |
|---------|-----|-----------------|--------------|--------------|
| **Community Operator** | ICP-1, ICP-2 | Low-Medium | Quick setup, no code | Wizard guides, videos |
| **DAO Tooling Dev** | ICP-3 | High | API integration | API docs, SDK |
| **Theme Creator** | Future | Medium | Custom themes | Theme SDK, examples |
| **Contributor** | Open source | High | Extend platform | Architecture docs |

### Audience Priority

| Audience | Priority | Investment | Expected Volume |
|----------|----------|------------|-----------------|
| Community Operators | P0 | 60% | 80% of users |
| API Integrators | P1 | 25% | 15% of users |
| Theme Creators | P2 | 10% | 5% of users |
| Contributors | P3 | 5% | <1% of users |

---

## Documentation Strategy

### Documentation Architecture

```
docs.arrakis.xyz (Future) / docs/ (Initial)
├── Getting Started
│   ├── Quick Start (5-min)
│   ├── Full Setup Guide (15-min)
│   └── Concepts Overview
├── Guides
│   ├── Token-Gating Setup
│   ├── Tier Configuration
│   ├── Badge System
│   ├── Coexistence Mode
│   └── Troubleshooting
├── API Reference
│   ├── Authentication
│   ├── Endpoints
│   ├── Webhooks
│   └── Rate Limits
├── Themes
│   ├── BasicTheme Guide
│   ├── SietchTheme Guide
│   └── Custom Themes (Enterprise)
└── Integration Guides
    ├── Snapshot Integration
    ├── Dune Dashboards
    └── Custom Bots
```

### Documentation Principles

| Principle | Implementation |
|-----------|----------------|
| **Task-oriented** | Organize by what users want to do, not product features |
| **Progressive disclosure** | Quick start → Full guide → Reference |
| **Code-first** | Every concept has a working example |
| **Versioned** | Docs match product version |
| **Searchable** | Full-text search, good headings |

### Documentation Types

| Type | Purpose | Audience | Format |
|------|---------|----------|--------|
| **Tutorials** | Learn by doing | New users | Step-by-step with screenshots |
| **How-to Guides** | Solve specific problems | Active users | Goal-oriented |
| **Reference** | Look up details | Developers | Comprehensive, scannable |
| **Explanation** | Understand concepts | Curious users | Conceptual, why-focused |

---

## Content Plan

### Launch Documentation (P0)

Must-have for launch:

| Document | Type | Audience | Status |
|----------|------|----------|--------|
| Quick Start Guide | Tutorial | All | To create |
| Setup Wizard Walkthrough | Tutorial | Operators | To create |
| Tier Configuration Guide | How-to | Operators | To create |
| Badge System Guide | How-to | Operators | To create |
| Coexistence Mode Guide | How-to | Migrators | To create |
| FAQ | Reference | All | To create |
| Troubleshooting | How-to | All | To create |

### Post-Launch Documentation (P1)

| Document | Type | Audience | Timeline |
|----------|------|----------|----------|
| API Reference | Reference | Developers | Month 2 |
| Webhook Guide | How-to | Developers | Month 2 |
| Snapshot Integration | Tutorial | Developers | Month 3 |
| Custom Theme Guide | Tutorial | Enterprise | Month 3 |
| SDK Documentation | Reference | Developers | Month 4 |

### Content Calendar

| Week | Content | Type | Channel |
|------|---------|------|---------|
| Launch | Quick Start Guide | Doc | Website |
| Launch | Setup Video (5 min) | Video | YouTube |
| Week 1 | "Why Conviction Scoring" | Blog | Website/Twitter |
| Week 2 | Tier Configuration Deep Dive | Tutorial | Docs |
| Week 3 | Badge System Guide | Tutorial | Docs |
| Week 4 | Coexistence Mode Explained | Blog | Website |
| Month 2 | API Reference | Docs | Website |
| Month 2 | "Building on Arrakis" | Blog | Website |
| Month 3 | Integration Tutorial #1 | Tutorial | Docs |

---

## Tutorial Strategy

### Tutorial Format

**Standard Tutorial Structure:**
```markdown
# [Task Title]

## Overview
What you'll accomplish, prerequisites, time estimate

## Before You Start
- Required: X
- Recommended: Y

## Step 1: [Action]
[Screenshot]
[Explanation]
[Code if applicable]

## Step 2: [Action]
...

## Verify It Works
How to confirm success

## Next Steps
Related tutorials, advanced topics

## Troubleshooting
Common issues and solutions
```

### Priority Tutorials

| Tutorial | Audience | Outcome | Priority |
|----------|----------|---------|----------|
| **Set Up Your First Community** | Operators | Working token-gated Discord | P0 |
| **Configure SietchTheme Tiers** | Premium users | 9-tier progression active | P0 |
| **Create Your First Badge** | Premium users | Custom badge awarded | P1 |
| **Run Shadow Mode** | Migrators | Coexistence proven | P1 |
| **Integrate with Snapshot** | Developers | Conviction in votes | P2 |
| **Build a Custom Theme** | Enterprise | Branded theme deployed | P2 |

### Video Content Strategy

| Video Type | Length | Purpose | Quantity |
|------------|--------|---------|----------|
| Quick Start | 5 min | First setup | 1 |
| Feature Deep Dives | 10-15 min | Education | 3-5 |
| Use Case Walkthroughs | 15-20 min | Inspiration | 2-3 |
| Live Setup Sessions | 30-60 min | Trust building | Monthly |

**Video Priorities:**
1. Quick Start (launch)
2. SietchTheme Setup (week 2)
3. Coexistence Mode (week 4)

---

## API Documentation

### API Overview

**Current API Surface:**

| Endpoint Category | Methods | Audience | Tier |
|-------------------|---------|----------|------|
| Community Management | CRUD | Operators | Premium |
| Eligibility Checks | Read | Integrators | Premium |
| Member Data | Read | Integrators | Enterprise |
| Webhook Subscriptions | CRUD | Developers | Enterprise |
| Analytics | Read | Admins | Enterprise |

### API Documentation Structure

```
/api-reference
├── Authentication
│   ├── API Keys
│   ├── OAuth (future)
│   └── Rate Limits
├── Endpoints
│   ├── Communities
│   ├── Members
│   ├── Tiers
│   ├── Badges
│   └── Eligibility
├── Webhooks
│   ├── Event Types
│   ├── Payload Format
│   └── Security (signatures)
├── SDKs
│   ├── TypeScript
│   └── Python (future)
└── Examples
    ├── Snapshot Integration
    ├── Custom Dashboard
    └── Airdrop Tool
```

### API Reference Format

**Endpoint Documentation Template:**
```markdown
## Get Community Members

Returns paginated list of community members with tier and badge data.

### Request

`GET /api/v1/communities/{community_id}/members`

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| community_id | string | Yes | Community UUID |

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| tier | string | all | Filter by tier name |
| limit | integer | 50 | Results per page (max 100) |
| cursor | string | null | Pagination cursor |

### Response

```json
{
  "members": [...],
  "cursor": "next_page_token",
  "total": 1234
}
```

### Example

```typescript
const members = await arrakis.communities.listMembers('comm_123', {
  tier: 'naib',
  limit: 10
});
```

### Errors

| Code | Description |
|------|-------------|
| 401 | Invalid API key |
| 404 | Community not found |
| 429 | Rate limit exceeded |
```

---

## SDK Strategy

### TypeScript SDK (Primary)

**Timeline:** Month 3-4

**Scope:**
- All public API endpoints
- Type definitions
- Error handling
- Rate limit handling
- Webhook signature verification

**Example API:**
```typescript
import { Arrakis } from '@arrakis/sdk';

const client = new Arrakis({ apiKey: process.env.ARRAKIS_API_KEY });

// Get community conviction data
const members = await client.communities.listMembers('comm_123', {
  tier: 'naib',
  includeConviction: true
});

// Check eligibility
const eligible = await client.eligibility.check({
  communityId: 'comm_123',
  walletAddress: '0x...',
  threshold: 'premium'
});

// Subscribe to webhooks
await client.webhooks.create({
  url: 'https://myapp.com/webhook',
  events: ['member.tier_changed', 'badge.awarded']
});
```

### Python SDK (Future)

**Timeline:** Month 6+ (if demand exists)

**Decision Criteria:**
- 10+ requests for Python SDK
- Enterprise customer requires it
- Partnership needs it

---

## Community Building

### Developer Community Channels

| Channel | Purpose | Priority |
|---------|---------|----------|
| **Discord #dev-support** | Real-time help | P0 |
| **GitHub Discussions** | Async Q&A, feature requests | P0 |
| **Twitter/X** | Announcements, engagement | P0 |
| **Blog** | Long-form education | P1 |
| **YouTube** | Video tutorials | P1 |

### Community Support Model

**Tiered Support:**

| Tier | Channel | Response Time | Who |
|------|---------|---------------|-----|
| Self-service | Docs, FAQ | Instant | Docs |
| Community | Discord, GitHub | <24h | Community/Team |
| Priority | Email | <8h | Team (Premium) |
| Dedicated | Slack | <4h SLA | Team (Enterprise) |

### Community Programs

#### Developer Champions

**Future Program (Month 6+):**
- Recognize top community contributors
- Early access to new features
- Direct line to product team
- Swag and recognition

**Criteria:**
- Active in Discord support
- Published tutorials or content
- Built public integrations

#### Office Hours

**Monthly Developer Office Hours:**
- Live Q&A with engineering team
- Demo new features
- Community feedback session
- Recorded and published

**Format:**
- Duration: 60 minutes
- Platform: Discord Stage or Twitter Spaces
- Frequency: Monthly
- Attendees: 10-50 developers

---

## Developer Experience (DX) Priorities

### DX Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to First Success | <15 min | Wizard completion time |
| Setup Completion Rate | >80% | Started vs completed |
| Doc Satisfaction | >4/5 | Inline feedback |
| Support Ticket Ratio | <5/100 users | Tickets per new user |
| API Time to First Call | <30 min | First successful API call |

### DX Improvements Roadmap

| Phase | Focus | Improvements |
|-------|-------|--------------|
| Launch | Wizard UX | Error messages, progress indicators |
| Month 1 | Docs | Search, feedback widgets |
| Month 2 | API | SDK, better error responses |
| Month 3 | Dashboard | Web dashboard for config (future) |

### Error Experience

**Error Message Principles:**
1. Say what went wrong
2. Say why it went wrong
3. Say how to fix it
4. Provide error code for support

**Example:**
```
ERROR: Insufficient permissions

The bot doesn't have "Manage Roles" permission in your server.

To fix:
1. Go to Server Settings > Roles
2. Find "Arrakis" role
3. Enable "Manage Roles" permission
4. Try again

Error Code: PERM_MANAGE_ROLES_MISSING
Need help? discord.gg/arrakis
```

---

## Content Creation Workflow

### Documentation Workflow

```
Feature Spec → Draft Docs → Review → Publish → Iterate
     │              │           │          │         │
     └──────────────┴───────────┴──────────┴─────────┘
                     Continuous
```

**Process:**
1. Engineering writes feature spec
2. DevRel drafts documentation alongside development
3. Engineering reviews for accuracy
4. Publish with feature release
5. Monitor feedback, iterate

### Content Review Checklist

- [ ] Technically accurate (engineering reviewed)
- [ ] Follows style guide
- [ ] Includes working examples
- [ ] Has screenshots where helpful
- [ ] Links to related content
- [ ] Searchable headings
- [ ] Mobile-friendly formatting

### Style Guide (Summary)

| Element | Standard |
|---------|----------|
| Voice | Direct, friendly, competent |
| Tense | Present tense ("Click the button") |
| Person | Second person ("You can...") |
| Code | Always include working examples |
| Screenshots | Annotated, current UI |
| Length | As short as possible, as long as necessary |

---

## Metrics & Feedback

### Documentation Metrics

| Metric | Tool | Target |
|--------|------|--------|
| Page views | Analytics | Growing MoM |
| Time on page | Analytics | >2 min for tutorials |
| Search queries | Search tool | Track gaps |
| Feedback ratings | Inline widget | >4/5 average |
| Support deflection | Ticket tagging | Track doc-solvable tickets |

### Feedback Collection

**Inline Feedback:**
```
Was this page helpful?
[Yes] [No]

[Optional: What could we improve?]
```

**Quarterly Survey:**
- NPS for documentation
- Feature requests
- Pain points
- Content gaps

### Feedback Loop

```
User Feedback → Triage → Prioritize → Update Docs → Close Loop
      │            │           │            │            │
      └────────────┴───────────┴────────────┴────────────┘
                           Weekly review
```

---

## Resource Requirements

### Year 1 DevRel Investment

| Activity | Time Investment | Owner |
|----------|-----------------|-------|
| Launch docs | 40 hours | Founder/DevRel |
| Ongoing docs | 4 hours/week | Founder/DevRel |
| Community support | 5 hours/week | Team |
| Video content | 8 hours/month | Founder |
| Office hours | 2 hours/month | Engineering |

### Tools

| Tool | Purpose | Cost |
|------|---------|------|
| **GitBook** or **Mintlify** | Documentation hosting | Free-$50/mo |
| **Loom** or similar | Video recording | Free-$15/mo |
| **Crisp** or **Intercom** | Support chat | Free tier |
| **Plausible** | Docs analytics | $9/mo |

**Total DevRel Tooling:** ~$50-100/month

---

## Implementation Roadmap

### Phase 1: Launch Documentation (Month 1)

- [ ] Quick Start Guide
- [ ] Setup Wizard Walkthrough
- [ ] Tier Configuration Guide
- [ ] Badge System Guide
- [ ] FAQ
- [ ] Troubleshooting Guide
- [ ] Quick Start Video (5 min)
- [ ] Discord #dev-support channel
- [ ] GitHub Discussions enabled

### Phase 2: API & Integrations (Month 2-3)

- [ ] API Reference (all endpoints)
- [ ] Authentication guide
- [ ] Webhook documentation
- [ ] Rate limiting guide
- [ ] First integration tutorial (Snapshot)
- [ ] TypeScript SDK alpha
- [ ] API changelog

### Phase 3: Scale & Community (Month 4-6)

- [ ] TypeScript SDK v1.0
- [ ] Additional integration tutorials
- [ ] Custom theme documentation (Enterprise)
- [ ] First office hours session
- [ ] Developer blog launch
- [ ] Video tutorial series (5 videos)
- [ ] Community feedback survey

### Phase 4: Mature (Month 6+)

- [ ] Developer Champions program
- [ ] Advanced tutorials library
- [ ] Python SDK (if demand)
- [ ] Interactive API explorer
- [ ] Community-contributed examples
- [ ] Localization (if international demand)

---

## Appendix: Documentation Templates

### Quick Start Template

```markdown
# Quick Start: [Feature]

Get [feature] working in under [time].

## Prerequisites

- [Requirement 1]
- [Requirement 2]

## Steps

### 1. [First Action]

[Screenshot if helpful]

[Explanation]

### 2. [Second Action]

...

## Verify It Works

[How to confirm success]

## Next Steps

- [Related tutorial 1]
- [Related tutorial 2]

## Need Help?

- [Discord link]
- [FAQ link]
```

### API Endpoint Template

```markdown
## [Endpoint Name]

[One-line description]

### Endpoint

`[METHOD] /api/v1/[path]`

### Authentication

[Auth requirements]

### Parameters

| Name | Type | Required | Description |
|------|------|----------|-------------|

### Response

```json
{
  "example": "response"
}
```

### Errors

| Code | Message | Resolution |
|------|---------|------------|

### Example

```typescript
// TypeScript example
```
```

---

## Appendix: Competitor DevRel Analysis

### Collab.Land Documentation

**Strengths:**
- Comprehensive Discord setup guides
- FAQ is thorough
- API documentation exists

**Weaknesses:**
- Dense, hard to navigate
- Video content sparse
- Community support varies

### Guild.xyz Documentation

**Strengths:**
- Clean, modern design
- Good getting started flow
- Feature-focused organization

**Weaknesses:**
- API docs limited
- Advanced topics sparse

### Arrakis Differentiation

| Area | Arrakis Approach |
|------|------------------|
| Navigation | Task-oriented (what you want to do) |
| Examples | Every feature has working code |
| Video | Key flows have video walkthroughs |
| API | Full reference with SDK |
| Support | Clear escalation path |

---

*Created via /plan-devrel on 2026-01-03*
