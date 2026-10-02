# Nova Cart Trust Engine

> *"Don't just promise an order. Predict whether you can fulfill it."*

A functional **demo prototype** for the Nova Cart PromptWars Business Rescue Challenge. It turns operational signals (inventory, store reliability, riders, traffic, pricing rules) into customer-facing decisions: what to show, what delivery time to promise, which promotions to allow, and when to compensate automatically.

> **Demo Mode:** all data is simulated. No real payments, riders, warehouses or paid APIs are used. No API keys needed.

## Problem

| Metric | Six months ago | Now |
|---|---|---|
| Repeat purchase rate | 41% | 27% |
| Average delivery time | 29 min | 37 min |
| Cancellation rate | 6% | 11% |
| Support tickets / month | 3,100 | 5,900 |

35% of cancellations come from product unavailability, 27% from delivery delay and 18% from store rejection. Customers report items vanishing after ordering (29%), slow delivery (34%), higher-than-expected prices (38%), confusing discounts (24%) and refund problems (16%). Partner stores say maintaining online inventory takes too much effort. Existing systems (app, partner dashboard, order DB, delivery tracking, payments, coupons, analytics) were built separately and do not share signals well.

The root problem is not only speed: **the app promises what it cannot reliably fulfil**, and failures compound into churn.

## Solution

A lightweight **Trust Engine** layer that orchestrates existing systems instead of replacing them:

1. **Predict fulfillment** with a transparent confidence score per product and store.
2. **Promise realistic delivery** with a dynamic ETA range.
3. **Gate promotions** by confidence (full / limited / disabled).
4. **Recover automatically** when an SLA is breached or an item fails.

## Key features

- Landing page, 7-section dashboard, Demo Mode badge, Reset Demo.
- **Overview:** case KPIs with six-month comparison, live Trust Health score, trend charts, failure-chain story (old model vs Trust Engine model).
- **Customer Experience ("Trust Picks"):** confidence-ranked catalog, hidden low-confidence items toggle, product detail with score breakdown, cart, coupon picker (auto-apply best), transparent price breakdown, delivery promise, order placement.
- **Trust Engine:** all product x store combinations, formula, live traffic/rider sliders, ETA component breakdown.
- **Partner Stores:** reliability ranking, store metrics, inventory table with one-tap In Stock / Out of Stock toggle (confidence recalculates), CSV bulk update with sample file.
- **Orders:** timeline, store accept/reject, rider assignment, delivery, cancel, delay, rider delay, missing item, item unavailable, substitution; **Recovery Engine** cards; simulated wallet.
- **Support Cockpit:** orders with risk/status/refund columns and working Approve Refund, Issue Credit, Reassign Rider, Contact Store actions; tickets ranked by *Prototype Risk Prioritization*.
- **Analytics:** case baseline vs *illustrative* simulation, scenario simulator with four sliders, business-impact numbers derived from the case.

## Architecture

```
Customer UI / Partner UI / Ops Cockpit   (React + Vite)
                 |
                 v
        Express API  (also runs as a Netlify Function)
                 |
        Trust Engine API
                 |
   +---- Inventory (stock, freshness, accuracy)
   +---- Orders & tickets
   +---- Store reliability
   +---- Delivery signals (riders, traffic, load)
   +---- Pricing / coupons
                 |
                 v
          Decision Layer
                 |
   +---- Reliable Catalog
   +---- Dynamic ETA
   +---- Coupon eligibility
   +---- Recovery Engine
   +---- Operations Cockpit
```

## Tech stack

- **Frontend:** React 18, Vite 5, plain CSS design system, lucide-react icons, hand-written SVG charts.
- **Backend:** Node.js, Express 4 (CommonJS), `serverless-http` for Netlify Functions.
- **Storage:** JSON seed files loaded into resettable in-memory state.
- **Deployment:** GitHub + Netlify.

## Project structure

```
nova-cart-trust-engine/
├── backend/
│   ├── app.js                 Express app and all routes
│   ├── server.js              Local server
│   ├── state.js               In-memory state built from JSON seeds
│   ├── csv.js                 Safe CSV parser (size/row limits)
│   ├── smoke-test.js          API smoke test (npm test)
│   ├── data/                  stores, products, inventory, orders, customers, riders, tickets, coupons, metrics
│   └── services/
│       ├── trustEngine.js     Confidence model
│       ├── etaEngine.js       Dynamic ETA
│       ├── pricingEngine.js   Quotes and coupon eligibility
│       ├── recoveryEngine.js  SLA breach / failure compensation
│       ├── supportEngine.js   Ticket prioritization
│       ├── orderService.js    Order lifecycle and support actions
│       └── analyticsEngine.js Trust health, scenario model
├── frontend/
│   ├── index.html, vite.config.mjs
│   └── src/ components/ pages/ layouts/ hooks/ services/ utils/
├── netlify/functions/api.js   Serverless wrapper for the Express app
├── netlify.toml, package.json, .env.example, .gitignore
```

## How to run

Requires Node 18+.

```bash
npm install
npm run dev        # API on :8787 + web app on :5173 (Vite proxies /api)
```

Open http://localhost:5173 and click **Open Operations Dashboard**.

Other commands:

```bash
npm run dev:api    # backend only
npm run dev:web    # frontend only
npm run build      # production build -> frontend/dist
npm test           # API smoke test (20 checks)
```

## Environment variables

See `.env.example`. Nothing is required locally.

| Variable | Purpose |
|---|---|
| `PORT` | Local API port (default 8787) |
| `VITE_API_BASE_URL` | Optional. Set only if the API lives on another origin. Defaults to `/api`. |

## API documentation

Base path `/api`. Errors are JSON: `{ "error": { "message": "..." } }`.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service status |
| GET | `/products` | Product list |
| GET | `/trust-picks` | Visible and hidden catalog with confidence, ETA, coupon tier |
| GET | `/trust-engine/products` | All product x store evaluations (optional `?traffic=1.4&riders=1` overrides) |
| POST | `/pricing/quote` | Server-side price, coupon options and promise for a cart |
| GET | `/stores`, `/stores/:id` | Store metrics, inventory with live confidence |
| GET | `/orders`, `/orders/:id` | Orders with computed health and risk |
| POST | `/orders` | Place order (server recalculates price, ETA, stock) |
| PATCH | `/orders/:id/status` | Validated status transition |
| GET | `/orders/:id/recovery` | Recovery actions for an order |
| POST | `/orders/:id/simulate-delay` | Body `{minutes}`; may trigger credit or refund |
| POST | `/orders/:id/simulate-rider-delay` | +10 min |
| POST | `/orders/:id/simulate-missing-item` | Partial refund |
| POST | `/orders/:id/simulate-unavailable` | Zeroes stock, partial refund |
| POST | `/orders/:id/simulate-substitution` | Notice + goodwill credit |
| POST | `/orders/:id/action` | Body `{action: refund|credit|reassign|contact}` |
| GET | `/wallet` | Simulated wallet of the demo customer |
| GET | `/support/tickets` | Tickets with priority score |
| POST | `/support/tickets/:id/refund`, `/credit` | Resolve ticket with action |
| GET | `/analytics` | Overview, trust health, trends, impact |
| GET | `/analytics/simulation` | Query: `inventoryAccuracy`, `riderAvailability`, `storeAcceptance`, `deliveryReliability` (40-99) |
| POST | `/inventory/update` | Body `{inventoryId, inStock}` |
| POST | `/inventory/bulk-update` | Body `{csv}` with `storeId,productId,qty` |
| POST | `/reset` | Reset demo data |

## Trust Engine formula (Prototype Confidence Model)

Deterministic weighted rules, **not machine learning**:

```
confidence = 0.35 * inventory
           + 0.20 * freshness
           + 0.20 * storeReliability
           + 0.15 * availabilityAccuracy
           + 0.10 * deliveryFeasibility
```

- inventory = 0 if qty 0, else `min(100, 40 + 6*qty)`
- freshness = 100 up to 2 h, then `-1.5` per hour (floor 5)
- storeReliability = `0.5*acceptance + 0.3*(100 - 4*cancel%) + 0.2*(100 - 2*substitution%)`
- deliveryFeasibility = `100 - 35*load - 60*(traffic-1) - 4*km + 3*min(riders,4)` (-30 if no riders)
- Out of stock caps at 20; offline store caps at 10.
- **>= 80 HIGH** (normal promotions) · **60-79 LIMITED** (discounts halved) · **< 60 AT RISK** (hidden by default, promotions disabled).

## ETA logic

```
ETA = storePrep(avgPrep * (1 + load/2)) + riderPickup(8) + travel(km * 4.5 * traffic)
      + reliabilityBuffer((100 - reliability)/100 * 8) + riderAdj(+/-) + handoff(3)
range width = 3 + (100 - confidence)/100 * 8 minutes
```

Rider adjustment: 4+ riders -2, 2-3 riders 0, 1 rider +4, none +10. Lower confidence widens the range instead of showing one optimistic number.

## Recovery logic

- **Delay:** `late = actual - promisedMax`. Credit = `min(100, 20 + ceil(1.5 * late))` (13 min late -> ₹40). Late by 25+ min: full refund and automatic support escalation.
- **Missing / unavailable item:** refund of the item line.
- **Substitution:** notice plus ₹15 goodwill credit.
- **Store rejection or cancellation:** instant full refund.
- Credits/refunds go to a simulated wallet; upgrades only pay the difference.

## Demo walkthrough (3-5 min)

1. Landing -> **Open Operations Dashboard**; show the problem KPIs and the failure chain.
2. **Customer Experience:** show Trust Picks, tick "Show hidden items" to see what the engine suppresses.
3. Open a product: confidence breakdown and promotion status.
4. Add to cart; show price breakdown and coupon eligibility; place the order.
5. On **Orders:** click Store accepts, Assign rider, then **Delivery delayed** -> automatic ₹40 credit appears (wallet badge updates).
6. Try **Item becomes unavailable** -> partial refund.
7. **Partner Stores:** toggle a product Out of Stock; confidence drops. Try **Bulk Update** with the sample CSV.
8. **Trust Engine:** drag traffic/riders sliders and watch ETAs and scores move.
9. **Support Cockpit:** Issue Credit, Approve Refund; see ticket priority.
10. **Analytics:** run the scenario simulator (label: illustrative).

## Business impact

Using the case's 38,500 monthly orders: every 1 pp of cancellation rate is ~385 orders/month. The Trust Engine targets each cause: **retention** (honest promises, automatic recovery), **cancellation** (hide unreliable items, deprioritize rejecting stores), **inventory accuracy** (confidence from freshness and history, low-effort partner tools), **delivery reliability** (ETA ranges), **refund friction** (instant compensation) and **support workload** (prioritized cockpit, fewer tickets created). The scenario simulator shows directional effects only.

## Limitations

- Simulated data; no real payments, riders, or event streaming.
- The confidence, ETA and simulation models are hand-written rules with illustrative coefficients, not trained or validated models. 2nd/3rd-order conversion, inventory accuracy and rider availability baselines are assumptions (labelled in the UI), not case data.
- State is in memory. Locally it persists until restart or Reset Demo. **On Netlify Functions each cold start or separate function instance starts from the seed data**, so a demo may occasionally revert; use Reset Demo, or run locally or on a persistent Node host for a fully stable demo.
- No authentication; one demo customer.

## Future improvements

Real event streaming (Kafka or managed equivalent), warehouse/ERP integration, real rider APIs, ML-based ETA and availability models, a production database, authentication and roles, observability and alerting.

## Deployment (GitHub + Netlify)

1. `git init && git add . && git commit -m "Nova Cart Trust Engine"`, create a GitHub repo and push.
2. In Netlify: **Add new site -> Import from Git** and select the repo.
3. Settings are read from `netlify.toml` (build `npm run build`, publish `frontend/dist`, functions `netlify/functions`; `/api/*` is redirected to the function). No environment variables are needed.
4. Deploy, then open the site URL. Check `/api/health`.
