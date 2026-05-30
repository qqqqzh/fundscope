'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'fundscope-investment-simulation';
const CHANGE_EVENT = 'fundscope-investment-simulation-change';

export type PlanMode = 'none' | 'one-time' | 'daily' | 'weekly' | 'monthly';
export type SimulationAction =
  | 'auto-invest'
  | 'one-time'
  | 'buy'
  | 'sell'
  | 'convert'
  | 'observe'
  | 'plan-change';
export type InputMode = 'amount' | 'shares' | 'ratio';
export type LogSource = 'user' | 'auto';

export interface SimulationGroup {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentPlan {
  mode: PlanMode;
  amount: number;
  startDate: string;
  lastExecutedNavDate?: string;
  enabled: boolean;
}

export interface SimulationFund {
  id: string;
  groupId: string;
  code: string;
  name: string;
  type: string;
  joinedAt: string;
  latestNav: number;
  latestNavDate: string;
  shares: number;
  totalInvested: number;
  totalSold: number;
  plan: InvestmentPlan;
}

export interface SimulationLog {
  id: string;
  groupId: string;
  fundCode: string;
  fundName: string;
  action: SimulationAction;
  amount: number;
  shares: number;
  nav: number;
  navDate: string;
  inputMode?: InputMode;
  targetFundCode?: string;
  targetFundName?: string;
  note?: string;
  tags: string[];
  createdAt: string;
  source: LogSource;
}

export interface SimulationStore {
  groups: SimulationGroup[];
  funds: SimulationFund[];
  logs: SimulationLog[];
}

export interface SimulationFundInput {
  code: string;
  name: string;
  type?: string;
  nav?: number;
  navDate?: string;
  dailyChange?: number;
}

export interface FundSummary extends SimulationFund {
  currentValue: number;
  pnl: number;
  returnRate: number;
}

export interface GroupSummary {
  totalInvested: number;
  currentValue: number;
  totalSold: number;
  pnl: number;
  returnRate: number;
  fundCount: number;
  logCount: number;
  maxDrawdown: number | null;
  volatility: number | null;
  upDays: number | null;
  downDays: number | null;
}

const EMPTY_STORE: SimulationStore = { groups: [], funds: [], logs: [] };
const ACTIONS: SimulationAction[] = ['auto-invest', 'one-time', 'buy', 'sell', 'convert', 'observe', 'plan-change'];

function nowIso() {
  return new Date().toISOString();
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emitChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGE_EVENT));
}

function parseNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizePlan(value: unknown): InvestmentPlan {
  const raw = value && typeof value === 'object' ? value as Partial<InvestmentPlan> : {};
  const mode = ['none', 'one-time', 'daily', 'weekly', 'monthly'].includes(raw.mode ?? '')
    ? raw.mode as PlanMode
    : 'none';
  return {
    mode,
    amount: parseNumber(raw.amount),
    startDate: typeof raw.startDate === 'string' ? raw.startDate : todayIsoDate(),
    lastExecutedNavDate: typeof raw.lastExecutedNavDate === 'string' ? raw.lastExecutedNavDate : undefined,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : false,
  };
}

function normalizeStore(value: unknown): SimulationStore {
  if (!value || typeof value !== 'object') return EMPTY_STORE;
  const raw = value as Partial<SimulationStore>;
  const groups = Array.isArray(raw.groups)
    ? raw.groups.filter((group): group is SimulationGroup => Boolean(
      group
      && typeof group.id === 'string'
      && typeof group.name === 'string'
      && typeof group.createdAt === 'string'
      && typeof group.updatedAt === 'string'
    ))
    : [];
  const funds = Array.isArray(raw.funds)
    ? raw.funds.filter((fund): fund is SimulationFund => Boolean(
      fund
      && typeof fund.id === 'string'
      && typeof fund.groupId === 'string'
      && typeof fund.code === 'string'
      && typeof fund.name === 'string'
    )).map(fund => ({
      ...fund,
      type: typeof fund.type === 'string' ? fund.type : '',
      joinedAt: typeof fund.joinedAt === 'string' ? fund.joinedAt : nowIso(),
      latestNav: parseNumber(fund.latestNav),
      latestNavDate: typeof fund.latestNavDate === 'string' ? fund.latestNavDate : '',
      shares: parseNumber(fund.shares),
      totalInvested: parseNumber(fund.totalInvested),
      totalSold: parseNumber(fund.totalSold),
      plan: normalizePlan(fund.plan),
    }))
    : [];
  const logs: SimulationLog[] = Array.isArray(raw.logs)
    ? raw.logs.filter((log): log is SimulationLog => Boolean(
      log
      && typeof log.id === 'string'
      && typeof log.groupId === 'string'
      && typeof log.fundCode === 'string'
      && typeof log.fundName === 'string'
      && ACTIONS.includes(log.action as SimulationAction)
    )).map(log => ({
      ...log,
      action: log.action as SimulationAction,
      amount: parseNumber(log.amount),
      shares: parseNumber(log.shares),
      nav: parseNumber(log.nav),
      navDate: typeof log.navDate === 'string' ? log.navDate : '',
      tags: Array.isArray(log.tags) ? log.tags.filter(tag => typeof tag === 'string') : [],
      createdAt: typeof log.createdAt === 'string' ? log.createdAt : nowIso(),
      source: log.source === 'auto' ? 'auto' as const : 'user' as const,
    }))
    : [];
  return { groups, funds, logs };
}

function loadStore(): SimulationStore {
  if (typeof window === 'undefined') return EMPTY_STORE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STORE;
    return normalizeStore(JSON.parse(raw));
  } catch {
    return EMPTY_STORE;
  }
}

function saveStore(store: SimulationStore) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  emitChange();
}

let cachedJson = '';
let cachedSnapshot = '';

function getSnapshot() {
  const json = JSON.stringify(loadStore());
  if (json !== cachedJson) {
    cachedJson = json;
    cachedSnapshot = json;
  }
  return cachedSnapshot;
}

function getServerSnapshot() {
  return JSON.stringify(EMPTY_STORE);
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function mutateStore(updater: (store: SimulationStore) => SimulationStore) {
  const next = updater(loadStore());
  saveStore(next);
  return next;
}

function touchGroup(groups: SimulationGroup[], groupId: string) {
  const updatedAt = nowIso();
  return groups.map(group => group.id === groupId ? { ...group, updatedAt } : group);
}

function toShares(amount: number, nav: number) {
  if (amount <= 0 || nav <= 0) return 0;
  return +(amount / nav).toFixed(4);
}

function shouldExecutePlan(plan: InvestmentPlan, navDate: string) {
  if (!plan.enabled || plan.amount <= 0 || !navDate) return false;
  if (plan.lastExecutedNavDate && navDate <= plan.lastExecutedNavDate) return false;
  if (navDate < plan.startDate) return false;
  if (plan.mode === 'daily') return true;
  if (plan.mode === 'weekly') {
    const last = plan.lastExecutedNavDate ? new Date(plan.lastExecutedNavDate) : new Date(plan.startDate);
    const next = new Date(navDate);
    return next.getTime() - last.getTime() >= 6 * 24 * 60 * 60 * 1000;
  }
  if (plan.mode === 'monthly') {
    const last = plan.lastExecutedNavDate ? new Date(plan.lastExecutedNavDate) : new Date(plan.startDate);
    const next = new Date(navDate);
    return next.getFullYear() > last.getFullYear() || next.getMonth() > last.getMonth();
  }
  return false;
}

export function summarizeFund(fund: SimulationFund): FundSummary {
  const currentValue = +(fund.shares * fund.latestNav).toFixed(2);
  const pnl = +(currentValue + fund.totalSold - fund.totalInvested).toFixed(2);
  const returnRate = fund.totalInvested > 0 ? +(pnl / fund.totalInvested * 100).toFixed(2) : 0;
  return { ...fund, currentValue, pnl, returnRate };
}

export function summarizeGroup(funds: SimulationFund[], logs: SimulationLog[]): GroupSummary {
  const summaries = funds.map(summarizeFund);
  const totalInvested = +summaries.reduce((sum, fund) => sum + fund.totalInvested, 0).toFixed(2);
  const currentValue = +summaries.reduce((sum, fund) => sum + fund.currentValue, 0).toFixed(2);
  const totalSold = +summaries.reduce((sum, fund) => sum + fund.totalSold, 0).toFixed(2);
  const pnl = +(currentValue + totalSold - totalInvested).toFixed(2);
  const returnRate = totalInvested > 0 ? +(pnl / totalInvested * 100).toFixed(2) : 0;
  return {
    totalInvested,
    currentValue,
    totalSold,
    pnl,
    returnRate,
    fundCount: funds.length,
    logCount: logs.length,
    maxDrawdown: null,
    volatility: null,
    upDays: null,
    downDays: null,
  };
}

export function useInvestmentSimulation() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const store = useMemo(() => normalizeStore(JSON.parse(snapshot)) as SimulationStore, [snapshot]);

  const createGroup = useCallback((name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return null;
    const group: SimulationGroup = {
      id: makeId('group'),
      name: cleanName,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    mutateStore(current => ({ ...current, groups: [...current.groups, group] }));
    return group;
  }, []);

  const addFundToGroup = useCallback((groupId: string, input: SimulationFundInput) => {
    const code = input.code.trim();
    if (!groupId || !code) return null;
    let result: SimulationFund | null = null;
    mutateStore(current => {
      const existing = current.funds.find(fund => fund.groupId === groupId && fund.code === code);
      if (existing) {
        result = existing;
        return current;
      }
      const fund: SimulationFund = {
        id: makeId('fund'),
        groupId,
        code,
        name: input.name || code,
        type: input.type ?? '',
        joinedAt: nowIso(),
        latestNav: input.nav ?? 0,
        latestNavDate: input.navDate ?? '',
        shares: 0,
        totalInvested: 0,
        totalSold: 0,
        plan: { mode: 'none', amount: 0, startDate: todayIsoDate(), enabled: false },
      };
      result = fund;
      return { ...current, groups: touchGroup(current.groups, groupId), funds: [...current.funds, fund] };
    });
    return result;
  }, []);

  const updateFundPlan = useCallback((fundId: string, plan: InvestmentPlan, note?: string) => {
    mutateStore(current => {
      const fund = current.funds.find(item => item.id === fundId);
      if (!fund) return current;
      const cleanPlan = normalizePlan(plan);
      const log: SimulationLog = {
        id: makeId('log'),
        groupId: fund.groupId,
        fundCode: fund.code,
        fundName: fund.name,
        action: 'plan-change',
        amount: cleanPlan.amount,
        shares: 0,
        nav: fund.latestNav,
        navDate: fund.latestNavDate,
        inputMode: 'amount',
        note,
        tags: [],
        createdAt: nowIso(),
        source: 'user',
      };
      return {
        ...current,
        groups: touchGroup(current.groups, fund.groupId),
        funds: current.funds.map(item => item.id === fundId ? { ...item, plan: cleanPlan } : item),
        logs: [log, ...current.logs],
      };
    });
  }, []);

  const recordBuy = useCallback((
    fundId: string,
    amount: number,
    action: SimulationAction,
    note = '',
    tags: string[] = [],
    source: LogSource = 'user',
    navDateOverride?: string,
  ) => {
    mutateStore(current => {
      const fund = current.funds.find(item => item.id === fundId);
      if (!fund || amount <= 0 || fund.latestNav <= 0) return current;
      const shares = toShares(amount, fund.latestNav);
      if (shares <= 0) return current;
      const log: SimulationLog = {
        id: makeId('log'),
        groupId: fund.groupId,
        fundCode: fund.code,
        fundName: fund.name,
        action,
        amount: +amount.toFixed(2),
        shares,
        nav: fund.latestNav,
        navDate: navDateOverride ?? fund.latestNavDate,
        inputMode: 'amount',
        note,
        tags,
        createdAt: nowIso(),
        source,
      };
      return {
        ...current,
        groups: touchGroup(current.groups, fund.groupId),
        funds: current.funds.map(item => item.id === fundId
          ? {
            ...item,
            shares: +(item.shares + shares).toFixed(4),
            totalInvested: +(item.totalInvested + amount).toFixed(2),
            plan: action === 'auto-invest' ? { ...item.plan, lastExecutedNavDate: log.navDate } : item.plan,
          }
          : item),
        logs: [log, ...current.logs],
      };
    });
  }, []);

  const recordManualBuy = useCallback((fundId: string, amount: number, note?: string, tags?: string[]) => {
    recordBuy(fundId, amount, 'buy', note, tags, 'user');
  }, [recordBuy]);

  const recordOneTime = useCallback((fundId: string, amount: number, note?: string, tags?: string[]) => {
    recordBuy(fundId, amount, 'one-time', note, tags, 'user');
  }, [recordBuy]);

  const recordManualSell = useCallback((
    fundId: string,
    value: number,
    inputMode: InputMode,
    note = '',
    tags: string[] = [],
  ) => {
    mutateStore(current => {
      const fund = current.funds.find(item => item.id === fundId);
      if (!fund || value <= 0 || fund.latestNav <= 0 || fund.shares <= 0) return current;
      const shares = inputMode === 'amount' ? toShares(value, fund.latestNav)
        : inputMode === 'ratio' ? +(fund.shares * value).toFixed(4)
        : +value.toFixed(4);
      const cleanShares = Math.min(shares, fund.shares);
      if (cleanShares <= 0) return current;
      const amount = +(cleanShares * fund.latestNav).toFixed(2);
      const log: SimulationLog = {
        id: makeId('log'),
        groupId: fund.groupId,
        fundCode: fund.code,
        fundName: fund.name,
        action: 'sell',
        amount,
        shares: cleanShares,
        nav: fund.latestNav,
        navDate: fund.latestNavDate,
        inputMode,
        note,
        tags,
        createdAt: nowIso(),
        source: 'user',
      };
      return {
        ...current,
        groups: touchGroup(current.groups, fund.groupId),
        funds: current.funds.map(item => item.id === fundId
          ? {
            ...item,
            shares: +(item.shares - cleanShares).toFixed(4),
            totalSold: +(item.totalSold + amount).toFixed(2),
          }
          : item),
        logs: [log, ...current.logs],
      };
    });
  }, []);

  const recordConversion = useCallback((
    sourceFundId: string,
    targetFundId: string,
    value: number,
    inputMode: InputMode,
    note = '',
    tags: string[] = [],
  ) => {
    mutateStore(current => {
      const source = current.funds.find(item => item.id === sourceFundId);
      const target = current.funds.find(item => item.id === targetFundId);
      if (!source || !target || source.groupId !== target.groupId || value <= 0 || source.latestNav <= 0 || target.latestNav <= 0) return current;
      const sourceShares = inputMode === 'amount' ? toShares(value, source.latestNav)
        : inputMode === 'ratio' ? +(source.shares * value).toFixed(4)
        : +value.toFixed(4);
      const cleanSourceShares = Math.min(sourceShares, source.shares);
      if (cleanSourceShares <= 0) return current;
      const amount = +(cleanSourceShares * source.latestNav).toFixed(2);
      const targetShares = toShares(amount, target.latestNav);
      if (targetShares <= 0) return current;
      const log: SimulationLog = {
        id: makeId('log'),
        groupId: source.groupId,
        fundCode: source.code,
        fundName: source.name,
        action: 'convert',
        amount,
        shares: cleanSourceShares,
        nav: source.latestNav,
        navDate: source.latestNavDate,
        inputMode,
        targetFundCode: target.code,
        targetFundName: target.name,
        note,
        tags,
        createdAt: nowIso(),
        source: 'user',
      };
      return {
        ...current,
        groups: touchGroup(current.groups, source.groupId),
        funds: current.funds.map(item => {
          if (item.id === sourceFundId) {
            return { ...item, shares: +(item.shares - cleanSourceShares).toFixed(4), totalSold: +(item.totalSold + amount).toFixed(2) };
          }
          if (item.id === targetFundId) {
            return { ...item, shares: +(item.shares + targetShares).toFixed(4), totalInvested: +(item.totalInvested + amount).toFixed(2) };
          }
          return item;
        }),
        logs: [log, ...current.logs],
      };
    });
  }, []);

  const recordObservation = useCallback((fundId: string, note: string, tags: string[] = []) => {
    mutateStore(current => {
      const fund = current.funds.find(item => item.id === fundId);
      if (!fund) return current;
      const log: SimulationLog = {
        id: makeId('log'),
        groupId: fund.groupId,
        fundCode: fund.code,
        fundName: fund.name,
        action: 'observe',
        amount: 0,
        shares: 0,
        nav: fund.latestNav,
        navDate: fund.latestNavDate,
        note,
        tags,
        createdAt: nowIso(),
        source: 'user',
      };
      return { ...current, logs: [log, ...current.logs] };
    });
  }, []);

  const removeFundFromGroup = useCallback((fundId: string) => {
    mutateStore(current => {
      const fund = current.funds.find(item => item.id === fundId);
      return {
        ...current,
        groups: fund ? touchGroup(current.groups, fund.groupId) : current.groups,
        funds: current.funds.filter(item => item.id !== fundId),
      };
    });
  }, []);

  const refreshFundQuotes = useCallback((quotes: SimulationFundInput[]) => {
    mutateStore(current => {
      let logs = current.logs;
      const funds = current.funds.map(fund => {
        const quote = quotes.find(item => item.code === fund.code);
        if (!quote) return fund;
        const latestNav = quote.nav && quote.nav > 0 ? quote.nav : fund.latestNav;
        const latestNavDate = quote.navDate || fund.latestNavDate;
        let nextFund: SimulationFund = { ...fund, name: quote.name || fund.name, type: quote.type ?? fund.type, latestNav, latestNavDate };
        if (latestNavDate && latestNav > 0 && shouldExecutePlan(nextFund.plan, latestNavDate)) {
          const shares = toShares(nextFund.plan.amount, latestNav);
          const log: SimulationLog = {
            id: makeId('log'),
            groupId: nextFund.groupId,
            fundCode: nextFund.code,
            fundName: nextFund.name,
            action: 'auto-invest',
            amount: +nextFund.plan.amount.toFixed(2),
            shares,
            nav: latestNav,
            navDate: latestNavDate,
            inputMode: 'amount',
            note: '自动定投',
            tags: [],
            createdAt: nowIso(),
            source: 'auto',
          };
          logs = [log, ...logs];
          nextFund = {
            ...nextFund,
            shares: +(nextFund.shares + shares).toFixed(4),
            totalInvested: +(nextFund.totalInvested + nextFund.plan.amount).toFixed(2),
            plan: { ...nextFund.plan, lastExecutedNavDate: latestNavDate },
          };
        }
        return nextFund;
      });
      return { ...current, funds, logs };
    });
  }, []);

  const groupsForFund = useCallback((code: string) => {
    const groupIds = new Set(store.funds.filter(fund => fund.code === code).map(fund => fund.groupId));
    return store.groups.filter(group => groupIds.has(group.id));
  }, [store.funds, store.groups]);

  return {
    store,
    createGroup,
    addFundToGroup,
    updateFundPlan,
    recordManualBuy,
    recordOneTime,
    recordManualSell,
    recordConversion,
    recordObservation,
    removeFundFromGroup,
    refreshFundQuotes,
    groupsForFund,
  };
}
