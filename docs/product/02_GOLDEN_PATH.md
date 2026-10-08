# LiveLift Golden Path v0.1

## Goal

Define the single best path through LiveLift before adding navigation, integrations, dashboards, or advanced AI.

## Golden Path

### 1. Home

The first screen has one dominant action:

CREATE LIVE

Secondary:
- Continue active LIVE
- Review previous LIVE

Do not show analytics cards on an empty account.

### 2. Create LIVE

Input:
- session name
- planned date/time
- optional objective

Output:
- internal session ID
- status = planned

TikTok connection is not required.

### 3. Build Product Pack

Ways to add products:
- paste rows;
- tab-separated clipboard;
- CSV;
- choose from catalog;
- clone previous session pack.

Minimum product fields:
- internal product ID/code
- name
- price (optional)
- priority
- operator notes
- source/as-of metadata when known

Observed external products must never silently become owned products.

### 4. Build Run of Show

Each segment has:
- ID
- title
- planned start/order
- planned duration
- type
- optional linked product
- notes / cue
- priority / constraints where needed

Example:
Opening
M01 Basic Tee
M02 Zip Hoodie
Flash Sale
M03 Cargo Pants
Closing

The plan is versioned before LIVE.

### 5. Start LIVE

Preflight shows:
- Product Pack ready
- Run of Show ready
- TikTok connection status
- data sources available
- missing optional capabilities

Starting is allowed in manual mode.

### 6. Operator Desk

Primary hierarchy:

CURRENT LIVE

NOW

NEXT

WHY

PRIMARY ACTION

Secondary:
- Run of Show
- Queue
- Pulse
- Product coverage
- timeline
- source health

No scroll should be required to see NOW/NEXT/WHY.

### 7. Runtime actions

Common operator actions:
- Accept suggestion
- Reject suggestion
- Start next segment
- Skip
- Extend
- Hold
- Mark product presented
- Mark native TikTok action attempted
- Mark operator-reported performed
- Add note

Actions are recorded with actor + timestamp + session + causation.

### 8. End LIVE

End LIVE freezes the active runtime state.

Post-LIVE outcomes can arrive later.

End LIVE does not mean all analytics are complete.

### 9. Semantic Replay

Replay shows:
- planned segment;
- actual segment timing;
- recommendations exposed;
- operator decisions;
- action attempts;
- reported/observed/confirmed evidence;
- data gaps;
- later outcomes.

Replay must preserve "what was known at the time."

### 10. Learn

Operator can save:
- observation;
- insight;
- hypothesis;
- reusable cue;
- warning/constraint;
- change for next session.

No causal claim unless evidence supports it.

### 11. Next LIVE

Create new session from:
- previous Product Pack;
- previous ROS;
- selected lessons;
- explicit change note.

The new session is a new plan version, not a mutation of history.
