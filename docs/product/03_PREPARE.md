# PREPARE — Product & UX Spec v0.1

## Job to be done

"I am about to livestream. Help me get the products and sequence ready without making me manage a complicated system."

## Screen objective

In five seconds, the operator should feel:

- I know which session this is.
- My products are ready.
- My sequence is ready.
- I can start.
- TikTok integration is optional.

## Primary layout

### Session header
Quiet, compact:
- session name
- date/time
- objective
- edit action

### Product Pack
Operational list, not ecommerce storefront.

Show:
- short code
- product name
- price
- priority
- status
- notes indicator

Actions:
- add
- paste/import
- reorder
- disable
- remove
- edit priority

Do not expose provider-specific fields in the main list.

### Run of Show
Timeline / rundown representation.

Show:
- order/time
- segment title
- linked product
- planned duration
- special type if relevant

Actions:
- add segment
- reorder
- edit
- duplicate
- delete

Advanced controls should appear on hover/menu.

### Connection status
Quiet secondary section:

TikTok
Not connected

Supporting copy:
"You can run this LIVE without connecting TikTok."

Do not use a red error state.

### Readiness
Simple readiness:
- Products ready
- Run of Show ready
- Optional integrations: unavailable/available

### Primary CTA
START LIVE

Only one dominant CTA.

## Empty states

No products:
"Add products for this LIVE"

No ROS:
"Create the first segment"

No TikTok:
"Not connected — manual mode is available"

## UX anti-patterns

Do not:
- use a 12-card dashboard;
- show charts;
- show raw APIs/scopes/providers;
- show a chatbot;
- force TikTok login;
- expose experiment settings by default;
- make every row contain five permanent buttons.

## Simulator support

PREPARE can choose:
- Manual mode
- Demo/Simulator mode

Simulator must be visibly labeled as simulated data.
