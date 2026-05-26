# Investment Simulation Design

## Purpose

Investment simulation is a forward-looking paper-investing workspace for FundScope. It lets a beginner investor collect funds into named simulation folders, assign fund-level investing methods, record daily decisions, and later review how those decisions performed against real fund NAV updates.

This feature is not a trading system, prediction engine, or investment-advice tool. It is a learning and decision-review tool.

## Current Context

The existing `/backtest` page is a placeholder. FundScope already has:

- Fund discovery and search in `/funds`.
- Watchlist management in `/watchlist`.
- Fund detail pages in `/fund/[code]`.
- Browser-local persistence patterns for watchlist and holdings.
- Backend and BFF routes that can fetch fund data and NAV history.

The first version should follow the existing local-first product style and store simulation data in `localStorage`, while keeping the model structured enough to migrate to backend storage later.

## Product Flow

Users should be able to add a fund to investment simulation from:

- The fund discovery page.
- The watchlist page.
- A fund detail page.

Each relevant fund row or detail header gets an "Add to simulation" action. Activating it opens a lightweight panel where the user can:

- Select an existing simulation group.
- Create a new simulation group.
- See which groups already contain this fund.
- Save the fund into one or more groups.

After saving, the panel offers two paths:

- Finish and remain on the current page.
- Continue configuring the simulation in the investment simulation page.

Simulation groups are simple named folders. They do not represent an account, strategy, or exclusive portfolio. A fund may belong to multiple simulation groups. When a fund has already been added to other groups, the panel shows those groups so the user understands the duplication.

## Simulation Page

The investment simulation page should be organized around daily return visits:

- A top summary area for total invested amount, current value, total profit or loss, and return rate.
- A group switcher for all groups and individual custom folders.
- A fund list for the active group.
- An operation log and review area.

Each fund in a group should show:

- Fund name and code.
- Latest NAV and NAV date.
- Current simulated shares.
- Current simulated value.
- Total invested amount.
- Total sold amount.
- Profit or loss.
- Return rate.
- Current investing method status.
- Actions for configure, buy, sell, convert, and observation note.

## Investing Methods

Investing methods are configured per fund within a group. A group can contain funds with different methods.

The first version supports:

- One-time investment.
- Daily recurring investment.
- Weekly recurring investment.
- Monthly recurring investment.
- Manual buy.
- Manual sell.
- Manual conversion to another fund in the same group.

Recurring investments are executed only when there is an effective NAV date from real fund data. The system should not infer trading days from weekdays. If no new valid NAV date exists, no recurring investment is generated.

When the user returns after several days, the simulation page checks the available NAV dates and automatically backfills recurring investment records that should have happened since the last execution.

## Sell and Convert

Selling supports:

- Input by amount.
- Input by shares.
- Quick sell by current holding ratio: one third, one half, or all.

Conversion supports:

- Source fund.
- Target fund from the same group.
- Input by amount or shares.
- The same quick ratio choices when converting by held shares.

In the first version, conversion is modeled as an immediate paper operation: sell the source fund and buy the target fund at the available NAV values. The log should preserve it as one conversion action for user review, while calculations may treat it as a sell plus buy internally.

## Operation Log

All meaningful simulation actions generate log records:

- Automatic recurring investment.
- One-time investment.
- Manual buy.
- Manual sell.
- Conversion.
- Observation without trade.
- Plan changes.

Each log entry records:

- Group id.
- Fund code and fund name.
- Action type.
- Amount when applicable.
- Shares when applicable.
- NAV and NAV date used for the action.
- Input unit, either amount or shares, when relevant.
- Optional target fund for conversions.
- User note.
- Emotion or confidence tags.
- Created timestamp.

Emotion and confidence tags should support review-oriented states such as calm, anxious, hesitant, confident, fear of missing out, panic, and conviction increased. The exact display copy can be refined during implementation, but the model should allow multiple tags per log entry.

## Data Model

The local data model should use separate collections so it can later move to a backend without changing the feature concept.

### Simulation Group

- `id`
- `name`
- `createdAt`
- `updatedAt`

### Group Fund

- `id`
- `groupId`
- `code`
- `name`
- `type`
- `joinedAt`
- `latestNav`
- `latestNavDate`
- `shares`
- `totalInvested`
- `totalSold`
- `plan`

### Investment Plan

- `mode`: none, one-time, daily, weekly, monthly
- `amount`
- `startDate`
- `lastExecutedNavDate`
- `enabled`

One-time investments should be represented through operation logs and reflected in aggregate calculations. A one-time plan can be used as a creation-time convenience but should not keep generating actions.

### Operation Log

- `id`
- `groupId`
- `fundCode`
- `fundName`
- `action`
- `amount`
- `shares`
- `nav`
- `navDate`
- `inputMode`
- `targetFundCode`
- `targetFundName`
- `note`
- `tags`
- `createdAt`
- `source`

`source` distinguishes user actions from automatic recurring investment records.

## Calculations

Fund-level calculations:

- Current value = current shares multiplied by latest NAV.
- Total invested = sum of buy, one-time, and recurring investment amounts for that fund in the group.
- Total sold = sum of sell-side proceeds for that fund in the group.
- Profit or loss = current value plus total sold minus total invested.
- Return rate = profit or loss divided by total invested, when total invested is greater than zero.

Group-level calculations:

- Total invested = sum of fund-level total invested.
- Current value = sum of fund-level current value.
- Total sold = sum of fund-level total sold.
- Profit or loss = current value plus total sold minus total invested.
- Return rate = profit or loss divided by total invested, when total invested is greater than zero.

Risk and trend metrics:

- Maximum drawdown.
- Volatility.
- Up days and down days.

The first version can compute risk metrics from available group daily value snapshots. If a group does not yet have enough observations, the UI should show an insufficient-data state rather than invent values.

## Automatic NAV Updates

When the simulation page loads, it should fetch the latest data for funds in active simulation groups.

For each fund:

- If a newer valid NAV date is returned, update latest NAV and NAV date.
- If recurring investment is enabled, generate missing automatic investment logs for valid NAV dates that match the plan cadence.
- If data fetching fails, keep the previous local value and show a non-blocking stale-data state.
- Failed fetches must not generate trades.

## Rule-Based Review

The first version uses rule-based review instead of AI-generated summaries.

Review summaries should be explainable and based on stored logs and NAV outcomes. Examples:

- Operations followed by 3-day, 7-day, and 14-day performance.
- Whether the user tends to buy after declines.
- Whether the user tends to buy after recent gains.
- Whether anxious or panic tags correlate with selling.
- Whether recurring investment execution is steady.
- Which funds most affected recent group performance.

An AI review entry point may be reserved in the UI, but it should be disabled or marked as future work in the first version.

## Error Handling

- If local storage contains invalid simulation data, ignore invalid records and preserve valid records.
- If fund data cannot be fetched, show stale data and avoid creating automatic logs.
- If a sell or conversion exceeds current shares, block the action and explain the limit.
- If a conversion target is missing or removed from the group, block conversion until the user selects a valid target.
- If a quick sell ratio produces a very small share amount, prevent zero-share operations.

## Testing Scope

The implementation should verify:

- Funds can be added to simulation from discovery, watchlist, and detail pages.
- Existing group membership is shown when adding a fund.
- The same fund can be added to multiple groups.
- Each fund can configure one-time, daily, weekly, and monthly investment behavior independently.
- Automatic recurring investments only execute when a valid NAV date exists.
- Manual buy, sell, conversion, observation, and plan-change logs are created correctly.
- Selling by amount, shares, one third, one half, and all calculates correctly.
- Conversion records the user-facing conversion action and updates source and target holdings.
- Summary metrics update after each action.
- Insufficient data states appear for risk and review sections.
- Fetch failures do not create trades.

## First-Version Non-Goals

- Real trading.
- Investment advice.
- Future price prediction.
- Backend account sync.
- Full brokerage settlement rules.
- Fees, taxes, redemption delays, or confirmation-day accounting.
- AI-written natural language review.
- Advanced strategy engines or conditional order rules.

