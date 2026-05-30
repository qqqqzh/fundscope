# Investment Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first usable investment simulation feature: local simulation folders, per-fund paper investing, logs, summaries, and "add to simulation" entry points.

**Architecture:** Keep persistence and calculations in focused client-safe library modules under `src/lib`. Use a reusable client component for adding funds to simulation from discovery, watchlist, and detail pages. Replace the placeholder `/backtest` page with a client dashboard that reads local simulation data, fetches latest fund data through existing API routes, and records paper operations.

**Tech Stack:** Next.js 16 App Router, React 19 Client Components, TypeScript, Tailwind CSS 4, `localStorage`, existing `/api/funds` and `/api/fund/[code]/analyze` routes.

---

### Task 1: Simulation Data Library

**Files:**
- Create: `src/lib/useInvestmentSimulation.ts`

- [ ] **Step 1: Create types and storage helpers**

Define `SimulationGroup`, `SimulationFund`, `InvestmentPlan`, `SimulationLog`, `SimulationAction`, `SimulationSummary`, and browser-safe load/save helpers using a `fundscope-investment-simulation` storage key.

- [ ] **Step 2: Implement mutation helpers**

Export a `useInvestmentSimulation()` hook with `createGroup`, `addFundToGroup`, `updateFundPlan`, `recordManualBuy`, `recordManualSell`, `recordConversion`, `recordObservation`, `removeFundFromGroup`, and `refreshFundQuotes`.

- [ ] **Step 3: Implement calculations**

Add pure helpers that derive fund and group summaries from stored funds and logs:

```ts
const currentValue = fund.shares * fund.latestNav;
const pnl = currentValue + fund.totalSold - fund.totalInvested;
const returnRate = fund.totalInvested > 0 ? pnl / fund.totalInvested * 100 : 0;
```

- [ ] **Step 4: Verify types**

Run: `npm run lint`

Expected: no TypeScript or ESLint errors from the new module.

### Task 2: Add-To-Simulation Entry Component

**Files:**
- Create: `src/components/investment/AddToSimulationButton.tsx`

- [ ] **Step 1: Create a reusable client button**

The component accepts fund metadata:

```ts
interface AddToSimulationButtonProps {
  fund: {
    code: string;
    name: string;
    type?: string;
    nav?: number;
    navDate?: string;
    dailyChange?: number;
  };
  compact?: boolean;
}
```

- [ ] **Step 2: Implement group picker panel**

The panel lists existing groups, allows creating a named group, shows groups already containing the fund, and supports "finish" or "continue configuring" after save.

- [ ] **Step 3: Verify interaction compiles**

Run: `npm run lint`

Expected: no lint errors.

### Task 3: Wire Entry Points

**Files:**
- Modify: `src/app/funds/page.tsx`
- Modify: `src/app/watchlist/page.tsx`
- Modify: `src/app/fund/[code]/page.tsx`

- [ ] **Step 1: Add the button to fund discovery rows**

Import `AddToSimulationButton` and render it next to the watchlist/detail actions for each fund row.

- [ ] **Step 2: Add the button to watchlist cards**

Render `AddToSimulationButton` for each watched fund using the local or refreshed metadata already present on the page.

- [ ] **Step 3: Add the button to fund detail header**

Render `AddToSimulationButton` with the fund code, display name, latest NAV, and latest NAV date.

- [ ] **Step 4: Verify pages compile**

Run: `npm run lint`

Expected: no lint errors.

### Task 4: Investment Simulation Dashboard

**Files:**
- Modify: `src/app/backtest/page.tsx`

- [ ] **Step 1: Replace placeholder with a client dashboard**

The dashboard includes total summary cards, group tabs, empty states, and a list of simulated funds.

- [ ] **Step 2: Add fund-level actions**

Each fund supports plan configuration, manual buy, manual sell by amount/shares/quick ratio, conversion to another fund in the same group, observation notes, and emotion tags.

- [ ] **Step 3: Add logs and review**

Show operation logs newest first and rule-based review cards for activity count, recurring discipline, emotion distribution, and largest fund-level impact.

- [ ] **Step 4: Refresh latest NAV**

On load, fetch latest fund metadata through existing API routes, update stale values, and auto-fill due recurring investments only when valid NAV dates exist.

- [ ] **Step 5: Verify dashboard compiles**

Run: `npm run lint`

Expected: no lint errors.

### Task 5: Manual Verification

**Files:**
- No new files.

- [ ] **Step 1: Start the app**

Run: `npm run dev`

Expected: local server starts.

- [ ] **Step 2: Browser smoke test**

Use Playwright to open `/funds`, add a fund to a new simulation group, open `/backtest`, configure an investment, record buy/sell/observation, and confirm the summary/log update.

- [ ] **Step 3: Final verification**

Run: `npm run lint`

Expected: no lint errors.

