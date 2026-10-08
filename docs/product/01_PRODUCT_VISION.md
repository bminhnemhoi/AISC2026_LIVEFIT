# LiveLift Product Vision v0.1

Status: P0 product definition  
Implementation: NOT STARTED  
Source of truth: LiveLift-next

## 1. Product statement

LiveLift is an operational desk for livestream commerce.

It helps an operator prepare a LIVE session, run the show with a clear NOW / NEXT / WHY workflow, record what actually happened, and turn the session into reusable evidence for the next LIVE.

LiveLift is not:
- a TikTok clone;
- a generic analytics dashboard;
- an AI chatbot;
- an OBS replacement;
- a crawler-first competitor intelligence platform;
- an automatic causal claim engine.

## 2. Core product loop

PREPARE
→ OPERATE
→ RECORD
→ REVIEW
→ LEARN
→ NEXT LIVE

Future integrations can enrich this loop, but must not be required for the core product to function.

## 3. Target user for MVP

Primary:
- operator / live assistant working alongside a host;
- small TikTok Shop LIVE team in Vietnam;
- teams currently coordinating through spreadsheets, notes, chat, and TikTok LIVE Manager.

Secondary:
- host who needs a simplified current/next view;
- analyst reviewing the session after LIVE.

Not in MVP:
- multi-platform enterprise operations;
- agencies managing hundreds of simultaneous rooms;
- automated media buying;
- CRM / ERP / payments;
- full creator marketplace.

## 4. Core promise

Within five seconds, the operator should be able to answer:

1. What session am I operating?
2. What are we presenting now?
3. What should happen next?
4. Why?
5. What action is expected?
6. What has actually happened?
7. What is still unknown or unverified?

After the session, the operator should be able to answer:

1. What was planned?
2. What actually happened?
3. Which recommendations were shown?
4. Which ones were accepted, rejected, or overridden?
5. Which actions were reported, observed, or confirmed?
6. What useful lesson should be carried to the next session?

## 5. Product principles

### Manual-first
The product must remain useful with no TikTok API, no vendor, no extension, and no realtime connector.

### Evidence before confidence
A recommendation must point to observable inputs or explicit rules. Missing data must remain missing.

### Planned is not actual
Run of Show, operator report, provider observation, and platform confirmation are distinct states.

### Requested is not performed
An accepted recommendation is not an executed action.

### Performed is not verified
Operator-reported action is not platform confirmation.

### Unknown is a valid state
Unknown must never silently become failed or zero.

### Providers are replaceable
TikTok, Euler, market-data vendors, DOM observers, and simulator feeds are adapters. The LiveLift core must not depend on one provider.

### UX before feature count
A small number of excellent workflows is better than a large dashboard.

## 6. MVP scope

MUST HAVE:
- Session creation
- Session Product Pack
- Run of Show
- Server-authoritative runtime
- NOW / NEXT / WHY
- Manual quick actions
- Decision/action/evidence ledger
- Semantic replay
- Hypothesis / result note
- Clone into next LIVE
- Simulator / demo provider

NICE TO HAVE after proof:
- TikTok official catalog sync
- TikTok official post-LIVE analytics
- Creator LIVE signals
- managed realtime engagement provider
- simple host view
- optional market context provider

FUTURE:
- active product readback
- verified platform action control
- optional browser extension
- learned ranking
- experimentation engine
- multi-platform support

DO NOT PROMISE:
- auto pin/unpin
- causal revenue lift
- official raw chat websocket
- realtime GMV SLA
- exact product-minute revenue attribution
- autonomous operator

## 7. Success criteria for P0 product prototype

The product thesis survives only if a manual-first rehearsal can complete:

Prepare → Start LIVE → Run → Override/Skip/Extend → Log action → End LIVE → Replay → Create next-session lesson

without external providers.

A prototype is successful when:
- operator always understands current and next state;
- logging does not become the main job;
- replay can explain a decision without inventing facts;
- provider loss does not break the session;
- the product is clearly more useful than spreadsheet + chat for the chosen workflow.
