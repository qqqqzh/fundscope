'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'fundscope-watchlist';
const META_STORAGE_KEY = 'fundscope-watchlist-meta';
const CHANGE_EVENT = 'fundscope-watchlist-change';

export interface WatchlistFundMeta {
  code: string;
  name: string;
  type: string;
  sectors?: string[];
  nav: number;
  dailyChange: number;
  navDate?: string;
  weekChange?: number;
  monthChange?: number;
  yearChange?: number;
  accNav?: number;
}

function loadFromStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function loadMetaFromStorage(): Record<string, WatchlistFundMeta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function getWatchlistMeta(code: string): WatchlistFundMeta | undefined {
  return loadMetaFromStorage()[code];
}

export function saveWatchlistMeta(meta: WatchlistFundMeta) {
  if (typeof window === 'undefined') return;
  try {
    const current = loadMetaFromStorage();
    current[meta.code] = meta;
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(current));
  } catch {}
}

function removeWatchlistMeta(code: string) {
  if (typeof window === 'undefined') return;
  try {
    const current = loadMetaFromStorage();
    delete current[code];
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(current));
  } catch {}
}

function getSnapshot() {
  return JSON.stringify(loadFromStorage());
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

function saveToStorage(codes: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(codes));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {}
}

export function useWatchlist() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const codes = useMemo(() => JSON.parse(snapshot) as string[], [snapshot]);

  const addFund = useCallback((code: string, meta?: WatchlistFundMeta) => {
    const current = loadFromStorage();
    if (meta) saveWatchlistMeta(meta);
    if (!current.includes(code)) {
      saveToStorage([...current, code]);
    }
  }, []);

  const removeFund = useCallback((code: string) => {
    const current = loadFromStorage();
    removeWatchlistMeta(code);
    saveToStorage(current.filter(c => c !== code));
  }, []);

  const toggleFund = useCallback((code: string, meta?: WatchlistFundMeta) => {
    const current = loadFromStorage();
    if (current.includes(code)) {
      removeWatchlistMeta(code);
      saveToStorage(current.filter(c => c !== code));
    } else {
      if (meta) saveWatchlistMeta(meta);
      saveToStorage([...current, code]);
    }
  }, []);

  const isWatched = useCallback((code: string): boolean => {
    return codes.includes(code);
  }, [codes]);

  return { codes, addFund, removeFund, toggleFund, isWatched };
}
