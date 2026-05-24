'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { getWatchlistMeta, type WatchlistFundMeta } from './useWatchlist';

const STORAGE_KEY = 'fundscope-holdings';
const CHANGE_EVENT = 'fundscope-holdings-change';

export interface HoldingEntry {
  id: string;
  code: string;
  name: string;
  marketValue: number;   // 持有金额
  pnl: number;           // 持有收益
}

function isValidEntry(e: unknown): e is HoldingEntry {
  if (!e || typeof e !== 'object') return false;
  const entry = e as Record<string, unknown>;
  return typeof entry.id === 'string'
    && typeof entry.code === 'string'
    && typeof entry.marketValue === 'number' && entry.marketValue > 0
    && typeof entry.pnl === 'number';
}

function loadHoldings(): HoldingEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isValidEntry);
    // Clean up if there were invalid entries
    if (valid.length !== parsed.length) {
      saveHoldings(valid);
    }
    return valid;
  } catch {}
  return [];
}

function saveHoldings(entries: HoldingEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {}
}

function getSnapshot() {
  return JSON.stringify(loadHoldings());
}

function getServerSnapshot() {
  return '[]';
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function useHoldings() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const entries = useMemo(() => JSON.parse(snapshot) as HoldingEntry[], [snapshot]);

  const addHolding = useCallback((entry: Omit<HoldingEntry, 'id'>) => {
    const current = loadHoldings();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const meta = getWatchlistMeta(entry.code);
    const newEntry: HoldingEntry = {
      ...entry,
      id,
      name: entry.name || meta?.name || entry.code,
    };
    saveHoldings([...current, newEntry]);
  }, []);

  const updateHolding = useCallback((id: string, updates: Partial<Omit<HoldingEntry, 'id'>>) => {
    const current = loadHoldings();
    saveHoldings(current.map(e => e.id === id ? { ...e, ...updates } : e));
  }, []);

  const removeHolding = useCallback((id: string) => {
    const current = loadHoldings();
    saveHoldings(current.filter(e => e.id !== id));
  }, []);

  return { entries, addHolding, updateHolding, removeHolding };
}

export interface HoldingSummary {
  id: string;
  code: string;
  name: string;
  type: string;
  sectors: string[];
  currentNav: number;
  shares: number;          // 持有份额 = marketValue / currentNav
  costNav: number;         // 成本净值 = costValue / shares
  marketValue: number;     // 持有金额
  costValue: number;       // 投入成本
  todayReturn: number;     // 今日收益（金额）
  todayReturnPct: number;  // 今日收益率
  pnl: number;             // 持有收益
  pnlPct: number;          // 持有收益率
  weight: number;
  navDate: string;         // 净值日期
  hasMarketData: boolean;  // 是否有行情数据（用于判断休盘）
}

export function computeHoldingsSummary(entries: HoldingEntry[]): HoldingSummary[] {
  const totalMarketValue = entries.reduce((sum, e) => sum + e.marketValue, 0);

  return entries.map(e => {
    const meta = getWatchlistMeta(e.code);
    const currentNav = meta?.nav ?? 0;
    const dailyChange = meta?.dailyChange ?? 0;
    const marketValue = e.marketValue;
    const pnl = e.pnl;
    const costValue = marketValue - pnl;
    const pnlPct = costValue > 0 ? (pnl / costValue) * 100 : 0;
    const shares = currentNav > 0 ? marketValue / currentNav : 0;
    const costNav = shares > 0 ? costValue / shares : 0;
    const hasMarketData = currentNav > 0;
    // 市值是当日涨跌后的值，反推收益: marketValue * r / (100 + r)
    const todayReturn = hasMarketData ? marketValue * dailyChange / (100 + dailyChange) : 0;

    return {
      id: e.id,
      code: e.code,
      name: e.name || meta?.name || e.code,
      type: meta?.type ?? '未知',
      sectors: meta?.sectors ?? [],
      currentNav,
      shares,
      costNav,
      marketValue,
      costValue,
      todayReturn,
      todayReturnPct: hasMarketData ? dailyChange : 0,
      pnl,
      pnlPct,
      weight: totalMarketValue > 0 ? (marketValue / totalMarketValue) * 100 : 0,
      navDate: meta?.navDate ?? '',
      hasMarketData,
    };
  }).sort((a, b) => b.marketValue - a.marketValue);
}
