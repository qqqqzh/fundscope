import { getMockFundDetail } from '@/data/mock-funds';
import type { FundDetail } from '@/types/fund';

export interface NavPoint {
  date: string;
  nav: number;
}

export interface FundHoldingItem {
  name: string;
  weight: number;
  industry: string;
}

export interface FundRiskSnapshot {
  maxDrawdown: number;
  volatility: number;
  sharpe: number;
  calmar: number;
  annualReturn: number;
}

export interface FundAnalysisSnapshot {
  code: string;
  name: string;
  type: string;
  sectors: string[];
  nav: number;
  dailyChange: number;
  accNav: number;
  navHistory: NavPoint[];
  holding: FundHoldingItem[];
  risk: FundRiskSnapshot;
}

export interface WatchlistFundSnapshot {
  code: string;
  name: string;
  type: string;
  sectors: string[];
  nav: number;
  dailyChange: number;
  weekChange: number;
  monthChange: number;
  yearChange: number;
}

const detailCache = new Map<string, FundDetail>();
const analysisCache = new Map<string, FundAnalysisSnapshot>();

function getCachedDetail(code: string) {
  const cached = detailCache.get(code);
  if (cached) return cached;

  const detail = getMockFundDetail(code);
  if (detail) detailCache.set(code, detail);
  return detail;
}

function periodChange(navHistory: NavPoint[], tradingDays: number) {
  if (navHistory.length < 2) return 0;

  const latest = navHistory[navHistory.length - 1].nav;
  const baseIndex = Math.max(0, navHistory.length - 1 - tradingDays);
  const base = navHistory[baseIndex]?.nav;

  if (!base) return 0;
  return (latest / base - 1) * 100;
}

function buildRiskSnapshot(detail: FundDetail, navHistory: NavPoint[]): FundRiskSnapshot {
  const maxDrawdown = Math.abs(detail.riskMetrics.maxDrawdown);
  const annualReturn = periodChange(navHistory, Math.min(252, navHistory.length - 1));

  return {
    maxDrawdown,
    volatility: detail.riskMetrics.volatility,
    sharpe: detail.riskMetrics.sharpeRatio,
    calmar: maxDrawdown ? annualReturn / maxDrawdown : 0,
    annualReturn,
  };
}

export function getLocalAnalysisSnapshot(code: string): FundAnalysisSnapshot | null {
  const cached = analysisCache.get(code);
  if (cached) return cached;

  const detail = getCachedDetail(code);
  if (!detail) return null;

  const navHistory = detail.navHistory.map(item => ({
    date: item.date,
    nav: item.nav,
  }));
  const latestPoint = detail.navHistory[detail.navHistory.length - 1];

  const snapshot: FundAnalysisSnapshot = {
    code,
    name: detail.name,
    type: detail.type,
    sectors: [],
    nav: latestPoint?.nav ?? detail.nav,
    dailyChange: detail.dailyChange,
    accNav: latestPoint?.accNav ?? detail.nav,
    navHistory,
    holding: detail.holding.topStocks,
    risk: buildRiskSnapshot(detail, navHistory),
  };

  analysisCache.set(code, snapshot);
  return snapshot;
}

export function getLocalWatchlistSnapshot(code: string): WatchlistFundSnapshot {
  const analysis = getLocalAnalysisSnapshot(code);

  if (!analysis) {
    return {
      code,
      name: code,
      type: '未知',
      sectors: [],
      nav: 0,
      dailyChange: 0,
      weekChange: 0,
      monthChange: 0,
      yearChange: 0,
    };
  }

  return {
    code,
    name: analysis.name,
    type: analysis.type,
    sectors: analysis.sectors,
    nav: analysis.nav,
    dailyChange: analysis.dailyChange,
    weekChange: periodChange(analysis.navHistory, 5),
    monthChange: periodChange(analysis.navHistory, 21),
    yearChange: periodChange(analysis.navHistory, 252),
  };
}
