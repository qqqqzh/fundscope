'use client';

import { useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  BarChart3,
  Brain,
  ChevronDown,
  ChevronUp,
  Search,
  ChevronRight,
  X,
} from 'lucide-react';
import {
  getLocalAnalysisSnapshot,
  type FundAnalysisSnapshot,
  type FundHoldingItem,
  type FundRiskSnapshot,
  type NavPoint,
} from '@/lib/localFundData';
import { getWatchlistMeta, type WatchlistFundMeta } from '@/lib/useWatchlist';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

const UP_COLOR = '#ef4444';
const DOWN_COLOR = '#22c55e';
const GRID_COLOR = 'rgba(148,163,184,0.16)';
const AXIS_COLOR = '#94a3b8';
const MAIN_GRID_LEFT = 60;
const MAIN_GRID_RIGHT = 24;
const SIGNAL_CLEAR_STRIP = 36;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type AnalyzeData = FundAnalysisSnapshot;

type RemoteAnalyzePayload = Partial<Omit<AnalyzeData, 'holding' | 'risk' | 'navHistory'>> & {
  error?: string;
  navHistory?: Array<Partial<NavPoint>>;
  holding?: Array<Partial<FundHoldingItem>>;
  risk?: Partial<FundRiskSnapshot>;
};

type EChartsInstance = {
  dispatchAction: (payload: Record<string, unknown>) => void;
  setOption: (option: Record<string, unknown>, opts?: { notMerge?: boolean; replaceMerge?: string[] }) => void;
  getOption: () => Record<string, unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off: (event: string, handler?: (...args: unknown[]) => void) => void;
};

interface OhlcPoint {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
}

function navToOHLC(navHistory: { date: string; nav: number }[]): OhlcPoint[] {
  return navHistory.map((item, index, arr) => {
    const close = item.nav;
    const open = index > 0 ? arr[index - 1].nav : close;
    const change = Math.abs(close - open);
    const baseWick = Math.max(change * 0.4, close * 0.0008);
    // 模拟非对称影线：阳线时下方影线更长（盘中回踩），阴线时上方影线更长（盘中反弹）
    const isUp = close >= open;
    const upperWick = isUp ? baseWick * 0.45 : baseWick * 1.25;
    const lowerWick = isUp ? baseWick * 1.25 : baseWick * 0.45;
    return {
      date: item.date,
      open: +open.toFixed(4),
      close: +close.toFixed(4),
      high: +(Math.max(open, close) + upperWick).toFixed(4),
      low: +(Math.max(0, Math.min(open, close) - lowerWick)).toFixed(4),
    };
  });
}

function calcDisplayMA(values: number[], period: number) {
  return values.map((_, index) => {
    const start = Math.max(0, index - period + 1);
    const slice = values.slice(start, index + 1);
    const avg = slice.reduce((sum, value) => sum + value, 0) / slice.length;
    return +avg.toFixed(4);
  });
}

function calcEMA(values: number[], period: number) {
  if (!values.length) return [];
  const factor = 2 / (period + 1);
  const result = [values[0]];

  for (let index = 1; index < values.length; index += 1) {
    result.push(values[index] * factor + result[index - 1] * (1 - factor));
  }

  return result;
}

function calcMACD(values: number[]) {
  const ema12 = calcEMA(values, 12);
  const ema26 = calcEMA(values, 26);
  const dif = ema12.map((value, index) => +(value - ema26[index]).toFixed(4));
  const dea = calcEMA(dif, 9).map(value => +value.toFixed(4));
  const macd = dif.map((value, index) => +((value - dea[index]) * 2).toFixed(4));
  return { dif, dea, macd };
}

function calcRSI(values: number[], period: number) {
  const result: Array<number | null> = [null];

  for (let index = 1; index < values.length; index += 1) {
    if (index < period) {
      result.push(null);
      continue;
    }

    let gains = 0;
    let losses = 0;

    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const diff = values[cursor] - values[cursor - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }

    if (losses === 0) {
      result.push(100);
      continue;
    }

    const rs = gains / losses;
    result.push(+(100 - 100 / (1 + rs)).toFixed(2));
  }

  return result;
}

function calcDrawdown(values: number[]) {
  if (!values.length) return [];

  let peak = values[0];
  return values.map(value => {
    if (value > peak) peak = value;
    return -+((((peak - value) / peak) * 100).toFixed(2));
  });
}

interface Signal {
  index: number;
  type: string;
  label: string;
  color: string;
}

const BEARISH_SIGNALS = new Set(['bigBear', 'bearEngulf', 'maDeadCross', 'macdDeadCross', 'rsiOverbought', 'bearDivergence']);
const BULLISH_SIGNALS = new Set(['bigBull', 'hammer', 'invHammer', 'bullEngulf', 'maGoldCross', 'macdGoldCross', 'rsiOversold', 'bullDivergence']);

function isBearishSignal(type: string) {
  return BEARISH_SIGNALS.has(type);
}

function signalDisplayColor(type: string) {
  if (isBearishSignal(type)) return DOWN_COLOR;
  if (BULLISH_SIGNALS.has(type)) return UP_COLOR;
  return '#f59e0b';
}

const SIGNAL_DESC: Record<string, string> = {
  bigBull: '大阳线：收盘价远高于开盘价，多方力量强劲，通常出现在上涨趋势中或底部反转时',
  bigBear: '大阴线：收盘价远低于开盘价，空方力量强劲，通常出现在下跌趋势中或顶部反转时',
  doji: '十字星：多空力量均衡，可能是趋势反转信号，需结合位置判断',
  hammer: '锤子线：长下影线+小实体，出现在下跌末端是见底反转信号',
  invHammer: '倒锤子：长上影线+小实体，出现在下跌末端是潜在反转信号，需次日确认',
  bullEngulf: '看涨吞没：阳线实体完全包裹前一根阴线，是强烈的底部反转信号',
  bearEngulf: '看跌吞没：阴线实体完全包裹前一根阳线，是强烈的顶部反转信号',
  maGoldCross: 'MA金叉：短期均线上穿长期均线，短线看涨信号',
  maDeadCross: 'MA死叉：短期均线下穿长期均线，短线看跌信号',
  macdGoldCross: 'MACD金叉：DIF线上穿DEA线，趋势转强信号',
  macdDeadCross: 'MACD死叉：DIF线下穿DEA线，趋势转弱信号',
  rsiOverbought: 'RSI超买：RSI高于70，短期涨势过猛，可能面临回调压力',
  rsiOversold: 'RSI超卖：RSI低于30，短期跌幅过大，可能出现技术反弹',
  bearDivergence: '顶背离：价格创出新高，但RSI未同步走高，上涨动能减弱，可能见顶',
  bullDivergence: '底背离：价格创出新低，但RSI未同步走低，下跌动能减弱，可能见底',
};

function findSignals(ohlc: OhlcPoint[], startIndex: number): Signal[] {
  const signals: Signal[] = [];
  const closes = ohlc.map(d => d.close);
  const ma5 = calcDisplayMA(closes, 5);
  const ma20 = calcDisplayMA(closes, 20);
  const { dif, dea } = calcMACD(closes);
  const rsi14 = calcRSI(closes, 14);

  // 计算基金日涨跌幅的统计数据，用于动态阈值
  const dailyChanges = closes.map((c, i) => (i > 0 ? Math.abs((c / closes[i - 1] - 1) * 100) : 0)).slice(1);
  dailyChanges.sort((a, b) => a - b);
  const p90 = dailyChanges[Math.floor(dailyChanges.length * 0.9)] ?? 1.5;

  for (let i = Math.max(startIndex, 10); i < ohlc.length; i++) {
    const candle = ohlc[i];
    const body = Math.abs(candle.close - candle.open);
    const bodyPct = (body / candle.open) * 100;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const totalRange = candle.high - candle.low || 1;
    const totalPct = (totalRange / candle.open) * 100;
    const upperWickRatio = upperWick / totalRange;
    const lowerWickRatio = lowerWick / totalRange;
    const bodyRatio = body / totalRange;

    // 大阳线：实体 > 0.4%，影线短（基金日涨跌幅通常较小）
    const bigBodyThreshold = Math.max(p90 * 0.5, 0.4);
    if (candle.close > candle.open && bodyPct > bigBodyThreshold && upperWickRatio < 0.25 && lowerWickRatio < 0.25) {
      signals.push({ index: i, type: 'bigBull', label: '大阳线', color: '#ef4444' });
    }

    // 大阴线
    if (candle.close < candle.open && bodyPct > bigBodyThreshold && upperWickRatio < 0.25 && lowerWickRatio < 0.25) {
      signals.push({ index: i, type: 'bigBear', label: '大阴线', color: '#22c55e' });
    }

    // 十字星：实体很小 + 上下影线都较长
    const dojiBodyMax = Math.max(0.03, bigBodyThreshold * 0.1);
    if (bodyPct < dojiBodyMax && upperWick > body * 1.2 && lowerWick > body * 1.2 && totalPct > dojiBodyMax * 1.5) {
      signals.push({ index: i, type: 'doji', label: '十字星', color: '#f59e0b' });
    }

    // 锤子线：下影线长 + 上影线短 + 处于局部低位
    if (bodyPct > 0.05 && lowerWick > body * 1.8 && upperWick < body * 0.8 && bodyRatio > 0.2) {
      const localLow = Math.min(...ohlc.slice(Math.max(0, i - 10), i + 1).map(c => c.low));
      if (candle.low <= localLow * 1.002) {
        signals.push({ index: i, type: 'hammer', label: '锤子线', color: '#ef4444' });
      }
    }

    // 倒锤子：上影线长 + 下影线短 + 处于局部高位
    if (bodyPct > 0.05 && upperWick > body * 1.8 && lowerWick < body * 0.8 && bodyRatio > 0.2) {
      signals.push({ index: i, type: 'invHammer', label: '倒锤子', color: '#f59e0b' });
    }

    // 吞没形态（基金版：方向反转 + 当日振幅明显大于前日）
    if (i >= 1) {
      const prev = ohlc[i - 1];
      const prevBody = Math.abs(prev.close - prev.open);
      // 看涨吞没：前阴后阳 + 当日实体 > 前日实体 *1.2
      if (candle.close > candle.open && prev.close < prev.open && body > prevBody * 1.2 && candle.close > prev.open) {
        signals.push({ index: i, type: 'bullEngulf', label: '看涨吞没', color: '#ef4444' });
      }
      // 看跌吞没：前阳后阴 + 当日实体 > 前日实体 *1.2
      if (candle.close < candle.open && prev.close > prev.open && body > prevBody * 1.2 && candle.close < prev.open) {
        signals.push({ index: i, type: 'bearEngulf', label: '看跌吞没', color: '#22c55e' });
      }
    }

    // 均线金叉/死叉
    if (i >= 1 && ma5[i] && ma20[i] && ma5[i - 1] && ma20[i - 1]) {
      if (ma5[i - 1] <= ma20[i - 1] && ma5[i] > ma20[i]) {
        signals.push({ index: i, type: 'maGoldCross', label: 'MA金叉', color: '#ef4444' });
      }
      if (ma5[i - 1] >= ma20[i - 1] && ma5[i] < ma20[i]) {
        signals.push({ index: i, type: 'maDeadCross', label: 'MA死叉', color: '#22c55e' });
      }
    }

    // MACD金叉/死叉
    if (i >= 1 && dif[i] != null && dea[i] != null && dif[i - 1] != null && dea[i - 1] != null) {
      if (dif[i - 1]! <= dea[i - 1]! && dif[i]! > dea[i]!) {
        signals.push({ index: i, type: 'macdGoldCross', label: 'MACD金叉', color: '#ef4444' });
      }
      if (dif[i - 1]! >= dea[i - 1]! && dif[i]! < dea[i]!) {
        signals.push({ index: i, type: 'macdDeadCross', label: 'MACD死叉', color: '#22c55e' });
      }
    }

    // RSI超买/超卖
    if (rsi14[i] != null) {
      if (rsi14[i]! > 70) {
        signals.push({ index: i, type: 'rsiOverbought', label: 'RSI超买', color: '#ef4444' });
      }
      if (rsi14[i]! < 30) {
        signals.push({ index: i, type: 'rsiOversold', label: 'RSI超卖', color: '#22c55e' });
      }
    }

    // 顶背离（价格新高，RSI走低）
    if (i >= 20 && rsi14[i] != null) {
      const lookback = Math.min(i, 20);
      const prevHighIdx = i - lookback + closes.slice(i - lookback, i).indexOf(Math.max(...closes.slice(i - lookback, i)));
      if (prevHighIdx >= 0 && closes[i] > closes[prevHighIdx] && rsi14[i]! < (rsi14[prevHighIdx] ?? 0)) {
        signals.push({ index: i, type: 'bearDivergence', label: '顶背离', color: '#f59e0b' });
      }
    }

    // 底背离（价格新低，RSI走高）
    if (i >= 20 && rsi14[i] != null) {
      const lookback = Math.min(i, 20);
      const prevLowIdx = i - lookback + closes.slice(i - lookback, i).indexOf(Math.min(...closes.slice(i - lookback, i)));
      if (prevLowIdx >= 0 && closes[i] < closes[prevLowIdx] && rsi14[i]! > (rsi14[prevLowIdx] ?? 0)) {
        signals.push({ index: i, type: 'bullDivergence', label: '底背离', color: '#3b82f6' });
      }
    }
  }

  return signals;
}

function normalizeRemoteData(result: RemoteAnalyzePayload, fallback: AnalyzeData | null): AnalyzeData | null {
  if (result.error) return fallback;

  const navHistory = Array.isArray(result.navHistory) && result.navHistory.length
    ? result.navHistory
      .filter((item): item is NavPoint => typeof item.date === 'string' && typeof item.nav === 'number')
      .map(item => ({ date: item.date, nav: item.nav }))
    : fallback?.navHistory ?? [];

  if (!navHistory.length && !fallback) return null;

  const latestNav = typeof result.nav === 'number'
    ? result.nav
    : navHistory[navHistory.length - 1]?.nav ?? fallback?.nav ?? 0;

  const holding = Array.isArray(result.holding) && result.holding.length
    ? result.holding.map(item => ({
      name: item.name ?? '',
      weight: typeof item.weight === 'number' ? item.weight : 0,
      industry: item.industry ?? '',
    })).filter(item => item.name && item.weight > 0)
    : fallback?.holding ?? [];

  const fallbackRisk = fallback?.risk ?? {
    maxDrawdown: 0,
    volatility: 0,
    sharpe: 0,
    calmar: 0,
    annualReturn: 0,
  };
  const remoteRisk = result.risk ?? {};

  return {
    code: result.code ?? fallback?.code ?? '',
    name: result.name ?? fallback?.name ?? result.code ?? '',
    type: result.type ?? fallback?.type ?? '未知',
    sectors: Array.isArray(result.sectors) ? result.sectors : fallback?.sectors ?? [],
    nav: latestNav,
    dailyChange: typeof result.dailyChange === 'number' ? result.dailyChange : fallback?.dailyChange ?? 0,
    accNav: typeof result.accNav === 'number' ? result.accNav : fallback?.accNav ?? latestNav,
    navHistory,
    holding,
    risk: {
      maxDrawdown: Math.abs(remoteRisk.maxDrawdown ?? fallbackRisk.maxDrawdown),
      volatility: remoteRisk.volatility ?? fallbackRisk.volatility,
      sharpe: remoteRisk.sharpe ?? fallbackRisk.sharpe,
      calmar: remoteRisk.calmar ?? fallbackRisk.calmar,
      annualReturn: remoteRisk.annualReturn ?? fallbackRisk.annualReturn,
    },
  };
}

function summaryFromMeta(meta: WatchlistFundMeta): AnalyzeData {
  return {
    code: meta.code,
    name: meta.name,
    type: meta.type,
    sectors: [],
    nav: meta.nav,
    dailyChange: meta.dailyChange,
    accNav: meta.accNav ?? meta.nav,
    navHistory: [],
    holding: [],
    risk: {
      maxDrawdown: 0,
      volatility: 0,
      sharpe: 0,
      calmar: 0,
      annualReturn: meta.yearChange ?? 0,
    },
  };
}

interface AnalysisSection {
  title: string;
  icon: string;
  color: string;
  items: string[];
}

function buildAnalysis(data: AnalyzeData): AnalysisSection[] {
  if (!data.navHistory.length) return [{ title: '数据不足', icon: '📊', color: 'text-gray-500', items: ['暂时无法生成分析。'] }];

  const navs = data.navHistory.map(item => item.nav);
  const latest = navs[navs.length - 1];
  const weekChange = navs.length >= 7 ? ((latest / navs[navs.length - 7] - 1) * 100) : 0;
  const monthChange = navs.length >= 30 ? ((latest / navs[navs.length - 30] - 1) * 100) : 0;
  const month3Change = navs.length >= 90 ? ((latest / navs[navs.length - 90] - 1) * 100) : 0;
  const yearChange = navs.length >= 250 ? ((latest / navs[navs.length - 250] - 1) * 100) : 0;
  const ma5 = calcDisplayMA(navs, 5);
  const ma20 = calcDisplayMA(navs, 20);
  const ma60 = calcDisplayMA(navs, 60);
  const { dif, dea, macd } = calcMACD(navs);
  const lastMa5 = ma5[ma5.length - 1];
  const lastMa20 = ma20[ma20.length - 1];
  const lastMa60 = ma60[ma60.length - 1];
  const lastDif = dif[dif.length - 1];
  const lastDea = dea[dea.length - 1];
  const lastMacd = macd[macd.length - 1];
  const rsiArr = calcRSI(navs, 14);
  const rsi14 = rsiArr[navs.length - 1] ?? null;
  const rsiPrev = navs.length >= 3 ? (rsiArr[navs.length - 3] ?? null) : null;
  const histHigh = Math.max(...navs);
  const histLow = Math.min(...navs);
  const drawdownFromHigh = ((latest - histHigh) / histHigh * 100);
  const rangePercent = histHigh > histLow ? ((latest - histLow) / (histHigh - histLow) * 100) : 50;
  const sections: AnalysisSection[] = [];

  // ── 技术指标（MA + MACD + RSI）──
  const techItems: string[] = [];

  // MA
  const maDev5 = ((latest - lastMa5) / lastMa5 * 100);
  if (lastMa5 > lastMa20 && lastMa20 > lastMa60) {
    techItems.push(`【均线】多头排列：MA5(${lastMa5.toFixed(4)}) > MA20(${lastMa20.toFixed(4)}) > MA60(${lastMa60.toFixed(4)})，趋势向上。净值偏离 MA5 ${maDev5 >= 0 ? '+' : ''}${maDev5.toFixed(2)}%${maDev5 > 3 ? '，短线偏离较大，注意回调' : '，偏离可控'}。`);
  } else if (lastMa5 < lastMa20 && lastMa20 < lastMa60) {
    techItems.push(`【均线】空头排列：MA5(${lastMa5.toFixed(4)}) < MA20(${lastMa20.toFixed(4)}) < MA60(${lastMa60.toFixed(4)})，趋势偏弱。净值偏离 MA5 ${maDev5 >= 0 ? '+' : ''}${maDev5.toFixed(2)}%${maDev5 < -3 ? '，短线超跌，关注企稳' : ''}。`);
  } else {
    techItems.push(`【均线】交织整理：MA5(${lastMa5.toFixed(4)})、MA20(${lastMa20.toFixed(4)})、MA60(${lastMa60.toFixed(4)}) 未形成统一方向，短期可能延续震荡。`);
  }

  // MACD
  const macdDirection = lastMacd >= 0 ? '红柱' : '绿柱';
  const macdTrend = macd.length >= 3 ? (macd[macd.length - 1] > macd[macd.length - 3] ? '放大' : '缩小') : '';
  if (lastDif > lastDea && lastMacd >= 0) {
    techItems.push(`【MACD】金叉状态：DIF(${lastDif.toFixed(4)}) > DEA(${lastDea.toFixed(4)})，${macdDirection}${macdTrend ? '正在' + macdTrend : ''}，短线动能偏强。`);
  } else if (lastDif < lastDea && lastMacd <= 0) {
    techItems.push(`【MACD】死叉状态：DIF(${lastDif.toFixed(4)}) < DEA(${lastDea.toFixed(4)})，${macdDirection}${macdTrend ? '正在' + macdTrend : ''}，短线动能偏弱。`);
  } else {
    techItems.push(`【MACD】切换中：DIF(${lastDif.toFixed(4)}) 与 DEA(${lastDea.toFixed(4)}) 交叉临近，多空博弈。`);
  }

  // RSI
  if (rsi14 !== null) {
    let rsiLabel = '';
    if (rsi14 > 80) rsiLabel = '严重超买，回调压力大';
    else if (rsi14 > 70) rsiLabel = '接近超买，注意冲高回落';
    else if (rsi14 > 55) rsiLabel = '偏强，多方占优';
    else if (rsi14 > 45) rsiLabel = '中性，多空平衡';
    else if (rsi14 > 30) rsiLabel = '偏弱，空方占优';
    else if (rsi14 > 20) rsiLabel = '接近超卖，留意反弹';
    else rsiLabel = '严重超卖，反弹概率大';
    const rsiDelta = rsiPrev !== null ? (rsi14 - rsiPrev) : 0;
    const rsiTrend = rsiDelta > 3 ? '，近期快速上升' : rsiDelta < -3 ? '，近期快速回落' : '';
    techItems.push(`【RSI】RSI(14) = ${rsi14.toFixed(1)}，${rsiLabel}${rsiTrend}。`);
  }

  sections.push({ title: '技术指标', icon: '📈', color: 'text-blue-500', items: techItems });

  // ── 风险评估 ──
  const riskItems: string[] = [];
  let volLevel = '';
  if (data.risk.volatility > 30) volLevel = '高波动';
  else if (data.risk.volatility > 20) volLevel = '中高波动';
  else if (data.risk.volatility > 12) volLevel = '中等波动';
  else if (data.risk.volatility > 5) volLevel = '低波动';
  else volLevel = '极低波动';
  riskItems.push(`年化波动率 ${data.risk.volatility.toFixed(2)}%（${volLevel}），最大回撤 ${data.risk.maxDrawdown.toFixed(2)}%。`);

  const highDate = data.navHistory[navs.indexOf(histHigh)]?.date ?? '';
  const lowDate = data.navHistory[navs.indexOf(histLow)]?.date ?? '';
  let positionComment = '';
  if (rangePercent > 80) positionComment = '历史高位';
  else if (rangePercent > 60) positionComment = '历史中高位';
  else if (rangePercent > 40) positionComment = '历史中位';
  else if (rangePercent > 20) positionComment = '历史中低位';
  else positionComment = '历史低位';
  riskItems.push(`净值 ${latest.toFixed(4)}，${positionComment}（百分位 ${rangePercent.toFixed(0)}%）。距高点 ${histHigh.toFixed(4)}（${highDate}）回撤 ${Math.abs(drawdownFromHigh).toFixed(2)}%，距低点 ${histLow.toFixed(4)}（${lowDate}）反弹 ${((latest - histLow) / histLow * 100).toFixed(2)}%。`);

  riskItems.push(`夏普比率 ${data.risk.sharpe.toFixed(2)}${data.risk.sharpe > 1 ? '（风险调整后收益较好）' : data.risk.sharpe > 0 ? '（风险调整后收益一般）' : '（风险调整后收益为负）'}，卡玛比率 ${data.risk.calmar.toFixed(2)}。`);
  sections.push({ title: '风险评估', icon: '⚠️', color: 'text-amber-500', items: riskItems });

  // ── 持仓分析 ──
  if (data.holding.length) {
    const holdItems: string[] = [];
    const top5 = data.holding.slice(0, 5);
    const top5Weight = top5.reduce((sum, item) => sum + item.weight, 0);
    const top3Weight = data.holding.slice(0, 3).reduce((sum, item) => sum + item.weight, 0);
    const industries = [...new Set(data.holding.map(item => item.industry).filter(Boolean))];
    top5.forEach((s, i) => holdItems.push(`${i + 1}. ${s.name} — 权重 ${s.weight.toFixed(2)}%${s.industry ? `（${s.industry}）` : ''}`));
    let concentrationComment = '';
    if (top3Weight > 40) concentrationComment = '集中度较高，重仓股波动对净值影响大';
    else if (top3Weight > 25) concentrationComment = '集中度适中';
    else concentrationComment = '持仓分散，个股风险较低';
    holdItems.push(`前三大合计 ${top3Weight.toFixed(2)}%，${concentrationComment}。行业：${industries.slice(0, 5).join('、') || '未披露'}。`);
    sections.push({ title: '持仓分析', icon: '📦', color: 'text-purple-500', items: holdItems });
  }

  // ── 收益表现 ──
  const perfItems: string[] = [];
  if (weekChange !== 0) perfItems.push(`近1周 ${weekChange >= 0 ? '+' : ''}${weekChange.toFixed(2)}%`);
  if (monthChange !== 0) perfItems.push(`近1月 ${monthChange >= 0 ? '+' : ''}${monthChange.toFixed(2)}%`);
  if (month3Change !== 0) perfItems.push(`近3月 ${month3Change >= 0 ? '+' : ''}${month3Change.toFixed(2)}%`);
  if (yearChange !== 0) perfItems.push(`近1年 ${yearChange >= 0 ? '+' : ''}${yearChange.toFixed(2)}%`);
  if (perfItems.length) {
    sections.push({ title: '收益表现', icon: '💰', color: 'text-green-500', items: perfItems });
  }

  // ── 综合评估 ──
  let score = 0;
  if (lastMa5 > lastMa20 && lastMa20 > lastMa60) score += 2;
  else if (lastMa5 < lastMa20 && lastMa20 < lastMa60) score -= 2;
  if (lastDif > lastDea) score += 1;
  else score -= 1;
  if (rsi14 !== null) {
    if (rsi14 > 60) score += 1;
    else if (rsi14 < 40) score -= 1;
  }
  if (monthChange > 3) score += 1;
  else if (monthChange < -3) score -= 1;
  if (data.risk.sharpe > 0.5) score += 1;
  if (rangePercent < 30) score += 1;
  else if (rangePercent > 80) score -= 1;

  let verdict = '';
  if (score >= 4) verdict = '偏乐观 — 技术面与基本面共振向好，可适当关注';
  else if (score >= 2) verdict = '中性偏乐观 — 部分指标向好，但仍有不确定性';
  else if (score >= 0) verdict = '中性 — 多空交织，建议观望为主';
  else if (score >= -2) verdict = '中性偏谨慎 — 部分指标转弱，注意控制仓位';
  else verdict = '偏谨慎 — 多项指标偏空，建议谨慎对待';
  sections.push({ title: '综合评估', icon: '🎯', color: 'text-indigo-500', items: [verdict] });

  return sections;
}

export default function WatchlistDetailPage() {
  const params = useParams();
  const codeParam = params.code;
  const code = (Array.isArray(codeParam) ? codeParam[0] : codeParam) ?? '';
  const localData = useMemo(() => getLocalAnalysisSnapshot(code), [code]);
  const metaData = useMemo(() => getWatchlistMeta(code), [code]);
  const summaryData = useMemo(() => localData ?? (metaData ? summaryFromMeta(metaData) : null), [localData, metaData]);
  const [data, setData] = useState<AnalyzeData | null>(() => summaryData);
  const [loading, setLoading] = useState(() => !summaryData);
  const [showAI, setShowAI] = useState(false);
  const [selectedRange, setSelectedRange] = useState('3m');
  const [signalMode, setSignalMode] = useState<'idle' | 'selecting' | 'found'>('idle');
  const [signals, setSignals] = useState<Signal[]>([]);
  const [currentSignalIdx, setCurrentSignalIdx] = useState(0);
  const rafRef = useRef<number | null>(null);
  const pendingCursorPctRef = useRef<number | null>(null);
  const ohlcRef = useRef<OhlcPoint[]>([]);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsInstance | null>(null);
  const dataZoomRef = useRef<{ start: number; end: number }>({ start: 0, end: 100 });
  const hasTrackedZoomRef = useRef(false);

  // 光标横坐标百分比（用于 CSS 遮罩）
  const [cursorPct, setCursorPct] = useState<number | null>(null);

  const enterSignalMode = () => {
    const rawOption = chartRef.current?.getOption();
    const dataZoom = rawOption && Array.isArray(rawOption.dataZoom) ? rawOption.dataZoom[0] as { start?: unknown; end?: unknown } : null;
    if (typeof dataZoom?.start === 'number' && typeof dataZoom?.end === 'number') {
      dataZoomRef.current = {
        start: clamp(dataZoom.start, 0, 100),
        end: clamp(dataZoom.end, 0, 100),
      };
      hasTrackedZoomRef.current = true;
    }
    chartRef.current?.dispatchAction({ type: 'hideTip' });
    setSignalMode('selecting');
    setCursorPct(50);
    setSignals([]);
    setCurrentSignalIdx(0);
  };

  const exitSignalMode = () => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    pendingCursorPctRef.current = null;
    chartRef.current?.dispatchAction({ type: 'hideTip' });
    setSignalMode('idle');
    setCursorPct(null);
    setSignals([]);
    setCurrentSignalIdx(0);
  };

  const findPrevSignal = () => {
    if (signals.length === 0) return;
    const prev = (currentSignalIdx - 1 + signals.length) % signals.length;
    setCurrentSignalIdx(prev);
  };

  const findNextSignal = () => {
    if (signals.length === 0) return;
    const next = (currentSignalIdx + 1) % signals.length;
    setCurrentSignalIdx(next);
  };

  useEffect(() => {
    let cancelled = false;

    setData(summaryData);
    setLoading(!summaryData);

    if (localData?.navHistory.length) {
      return () => { cancelled = true; };
    }

    const controller = new AbortController();
    let timeout: number | undefined;

    const startFetch = window.setTimeout(() => {
      timeout = window.setTimeout(() => controller.abort(), 8000);

      fetch(`/api/fund/${code}/analyze`, { signal: controller.signal })
        .then(r => r.json())
        .then((result: RemoteAnalyzePayload) => {
          if (cancelled) return;
          const normalized = normalizeRemoteData(result, summaryData);
          if (normalized) setData(normalized);
          setLoading(false);

          fetch(`/api/fund/${code}/holding`, { signal: controller.signal })
            .then(r => r.json())
            .then(h => {
              if (cancelled) return;
              const holding = Array.isArray(h.holding) ? h.holding : [];
              if (holding.length) setData(prev => prev ? { ...prev, holding } : prev);
            })
            .catch(() => {});
        })
        .catch(() => {
          if (cancelled) return;
          setData(summaryData);
          setLoading(false);
        })
        .finally(() => {
          if (timeout !== undefined) window.clearTimeout(timeout);
        });
    }, summaryData ? 900 : 0);

    return () => {
      cancelled = true;
      window.clearTimeout(startFetch);
      controller.abort();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [code, localData, summaryData]);

  const ohlc = useMemo(() => data?.navHistory.length ? navToOHLC(data.navHistory) : [], [data]);
  ohlcRef.current = ohlc;
  const currentSignal = useMemo(() =>
    signalMode === 'found' && signals.length > 0
      ? signals[Math.min(currentSignalIdx, signals.length - 1)]
      : null,
    [signalMode, signals, currentSignalIdx]);

  // 切换信号时仅更新标注点，不重绘整张图表（保持缩放不变）
  useEffect(() => {
    if (signalMode !== 'found' || !signals.length || !chartRef.current) return;
    const signal = signals[Math.min(currentSignalIdx, signals.length - 1)];
    const candle = ohlc[signal.index];
    if (!candle) return;
    const dates = ohlc.map(d => d.date);
    const isBearish = isBearishSignal(signal.type);
    const position = isBearish ? 'top' : 'bottom';
    const posVal = position === 'bottom' ? candle.low : candle.high;
    const color = signalDisplayColor(signal.type);
    const sigDesc = SIGNAL_DESC[signal.type] || signal.label;
    chartRef.current.setOption({
      series: [{
        name: '信号标注',
        data: [{
          value: [dates[signal.index], posVal],
          itemStyle: { color, borderColor: '#fff', borderWidth: 2 },
          label: {
            show: true, position, distance: 10,
            color: '#111827', fontSize: 11, fontWeight: 600,
            backgroundColor: 'rgba(255,255,255,0.94)',
            borderColor: color, borderWidth: 1, borderRadius: 6, padding: [3, 6],
            formatter: signal.label,
          },
        }],
        tooltip: {
          show: true, trigger: 'item' as const,
          formatter: () => `<div style="max-width:260px;font-size:12px;line-height:1.6;word-break:break-word;overflow-wrap:break-word;white-space:normal"><b style="color:${color}">${signal.label}</b><br/>${sigDesc}</div>`,
          extraCssText: 'border-radius:10px;padding:10px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.1);max-width:280px !important;',
        },
      }],
    });
  }, [currentSignalIdx, signalMode, signals, ohlc]);

  const rangeToStart = (range: string, total: number) => {
    const daysMap: Record<string, number> = { '1m': 30, '3m': 90, '6m': 180, '1y': 365, '3y': 1095, 'all': total };
    const days = daysMap[range] ?? 90;
    return Math.max(0, ((total - days) / total) * 100);
  };

  const trackZoomWindow = (start: number, end: number) => {
    dataZoomRef.current = {
      start: clamp(start, 0, 100),
      end: clamp(end, 0, 100),
    };
    hasTrackedZoomRef.current = true;
  };

  const handleChartDataZoom = (event: { start?: number; end?: number; batch?: Array<{ start?: number; end?: number }> }) => {
    const payload = event.batch?.[0] ?? event;
    if (typeof payload.start === 'number' && typeof payload.end === 'number') {
      trackZoomWindow(payload.start, payload.end);
      return;
    }

    const rawOption = chartRef.current?.getOption();
    const dataZoom = rawOption && Array.isArray(rawOption.dataZoom) ? rawOption.dataZoom[0] as { start?: unknown; end?: unknown } : null;
    if (typeof dataZoom?.start === 'number' && typeof dataZoom?.end === 'number') {
      trackZoomWindow(dataZoom.start, dataZoom.end);
    }
  };

  const getVisibleIndexWindow = (total: number) => {
    const rawOption = chartRef.current?.getOption();
    const dataZoom = rawOption && Array.isArray(rawOption.dataZoom) ? rawOption.dataZoom[0] as { start?: unknown; end?: unknown } : null;
    const fallbackStart = hasTrackedZoomRef.current ? dataZoomRef.current.start : rangeToStart(selectedRange, total);
    const fallbackEnd = hasTrackedZoomRef.current ? dataZoomRef.current.end : 100;
    const startPercent = typeof dataZoom?.start === 'number' ? dataZoom.start : fallbackStart;
    const endPercent = typeof dataZoom?.end === 'number' ? dataZoom.end : fallbackEnd;
    const start = clamp(Math.floor((clamp(startPercent, 0, 100) / 100) * (total - 1)), 0, total - 1);
    const end = clamp(Math.ceil((clamp(endPercent, 0, 100) / 100) * (total - 1)), start, total - 1);

    return { start, end };
  };

  const getSelectionFromClientX = (clientX: number) => {
    const container = chartContainerRef.current;
    const total = ohlcRef.current.length;
    if (!container || total === 0) return null;

    const rect = container.getBoundingClientRect();
    const rawX = clientX - rect.left;
    const cursor = clamp((rawX / rect.width) * 100, 0, 100);
    const plotLeft = MAIN_GRID_LEFT;
    const plotRight = Math.max(plotLeft + 1, rect.width - MAIN_GRID_RIGHT);
    const plotX = clamp(rawX, plotLeft, plotRight);
    const plotRatio = (plotX - plotLeft) / (plotRight - plotLeft);
    const visible = getVisibleIndexWindow(total);
    const visibleCount = Math.max(1, visible.end - visible.start);
    const index = clamp(Math.round(visible.start + plotRatio * visibleCount), visible.start, visible.end);

    return { cursor, index };
  };

  const updateSelectionCursor = (clientX: number) => {
    const selection = getSelectionFromClientX(clientX);
    if (!selection) return;

    pendingCursorPctRef.current = selection.cursor;
    if (rafRef.current !== null) return;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingCursorPctRef.current !== null) {
        setCursorPct(pendingCursorPctRef.current);
      }
    });
  };

  const selectSignalStart = (clientX: number) => {
    const selection = getSelectionFromClientX(clientX);
    if (!selection) return;

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    pendingCursorPctRef.current = null;
    chartRef.current?.dispatchAction({ type: 'hideTip' });
    setCursorPct(null);

    const found = findSignals(ohlcRef.current, selection.index);
    if (found.length > 0) {
      setSignals(found);
      setCurrentSignalIdx(0);
      setSignalMode('found');
      return;
    }

    setSignals([]);
    setCurrentSignalIdx(0);
    setSignalMode('idle');
  };

  const handleSelectionPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    updateSelectionCursor(event.clientX);
  };

  const handleSelectionMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    updateSelectionCursor(event.clientX);
  };

  const handleSelectionClick = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    selectSignalStart(event.clientX);
  };

  const handleSelectionPointerLeave = () => {
    chartRef.current?.dispatchAction({ type: 'hideTip' });
  };

  const technicalOption = useMemo(() => {
    if (!ohlc.length) return null;

    const dates = ohlc.map(item => item.date);
    const candleData = ohlc.map(item => [item.open, item.close, item.low, item.high]);
    const closes = ohlc.map(item => item.close);
    const ma5 = calcDisplayMA(closes, 5);
    const ma20 = calcDisplayMA(closes, 20);
    const ma60 = calcDisplayMA(closes, 60);
    const { dif, dea, macd } = calcMACD(closes);
    const rsi6 = calcRSI(closes, 6);
    const rsi14 = calcRSI(closes, 14);
    const drawdown = calcDrawdown(closes);
    const zoomStart = hasTrackedZoomRef.current ? dataZoomRef.current.start : rangeToStart(selectedRange, dates.length);
    const zoomEnd = hasTrackedZoomRef.current ? dataZoomRef.current.end : 100;

    const grids = [
      { left: 60, right: 24, top: 46, bottom: '50%', containLabel: true },
      { left: 60, right: 24, top: '55%', bottom: '35%', containLabel: true },
      { left: 60, right: 24, top: '68%', bottom: '19%', containLabel: true },
      { left: 60, right: 24, top: '84%', bottom: 28, containLabel: true },
    ];

    const xAxis = grids.map((_, gridIndex) => ({
      type: 'category' as const,
      data: dates,
      gridIndex,
      boundaryGap: true,
      axisLine: { lineStyle: { color: 'rgba(148,163,184,0.28)' } },
      axisLabel: gridIndex === grids.length - 1
        ? { color: AXIS_COLOR, fontSize: 11, rotate: 0, interval: 'auto' as const }
        : { color: 'rgba(148,163,184,0.55)', fontSize: 9, rotate: 0, interval: 'auto' as const },
      axisTick: { show: false },
    }));

    const yAxis: Record<string, unknown>[] = [
      {
        scale: true,
        axisLine: { show: false },
        axisLabel: { color: AXIS_COLOR, fontSize: 11 },
        splitLine: { lineStyle: { type: 'dashed' as const, color: GRID_COLOR } },
      },
      {
        scale: true,
        gridIndex: 1,
        axisLine: { show: false },
        axisLabel: { color: AXIS_COLOR, fontSize: 11 },
        splitLine: { show: false },
      },
      {
        min: 0,
        max: 100,
        gridIndex: 2,
        axisLine: { show: false },
        axisLabel: { color: AXIS_COLOR, fontSize: 11 },
        splitLine: { show: false },
      },
      {
        max: 0,
        min: Math.min(-Math.ceil(Math.abs(Math.min(...drawdown)) / 5) * 5 - 5, -5),
        gridIndex: 3,
        axisLine: { show: false },
        axisLabel: { color: AXIS_COLOR, fontSize: 11, formatter: '{value}%' },
        splitLine: { show: false },
      },
    ];

    const opt: Record<string, unknown> = {
      animation: false,
      title: [
        { text: '净值K线 · MA均线', left: 4, top: 8, textStyle: { fontSize: 14, fontWeight: 600, color: '#334155' } },
        { text: 'MACD', left: 4, top: '50.5%', textStyle: { fontSize: 13, fontWeight: 600, color: '#334155' } },
        { text: 'RSI', left: 4, top: '63.5%', textStyle: { fontSize: 13, fontWeight: 600, color: '#334155' } },
        { text: '回撤', left: 4, top: '79.5%', textStyle: { fontSize: 13, fontWeight: 600, color: '#334155' } },
      ],
      legend: [
        { data: ['MA5', 'MA20', 'MA60'], top: 8, right: 16, itemWidth: 14, itemHeight: 8, icon: 'circle', itemGap: 12, textStyle: { fontSize: 11, color: '#64748b' } },
        { data: ['DIF', 'DEA'], top: '50.5%', right: 16, itemWidth: 14, itemHeight: 8, icon: 'circle', itemGap: 12, textStyle: { fontSize: 11, color: '#64748b' } },
        { data: ['RSI(6)', 'RSI(14)'], top: '63.5%', right: 16, itemWidth: 14, itemHeight: 8, icon: 'circle', itemGap: 12, textStyle: { fontSize: 11, color: '#64748b' } },
        { data: ['回撤'], top: '79.5%', right: 16, itemWidth: 14, itemHeight: 8, icon: 'circle', itemGap: 12, textStyle: { fontSize: 11, color: '#64748b' } },
      ],
      tooltip: signalMode === 'selecting'
        ? { show: false }
        : {
          trigger: 'axis' as const,
          confine: false,
          appendToBody: true,
          axisPointer: { type: 'cross' as const },
          position: (_point: number[], _p: unknown, _d: unknown, _r: unknown, size: { contentSize: number[]; viewSize: number[] }) => {
            return [12, window.scrollY + window.innerHeight * 0.25 - size.contentSize[1] / 2];
          },
          extraCssText: 'font-size:11px;padding:8px 10px;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.1);',
        },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        label: { backgroundColor: '#475569' },
      },
      grid: grids,
      xAxis,
      yAxis,
      dataZoom: [{
        type: 'inside' as const,
        xAxisIndex: xAxis.map((_, index) => index),
        start: zoomStart,
        end: zoomEnd,
        zoomOnMouseWheel: true,
        moveOnMouseWheel: true,
      }],
      series: [
        {
          name: '净值K线',
          type: 'candlestick',
          data: candleData,
          itemStyle: {
            color: UP_COLOR,
            color0: DOWN_COLOR,
            borderColor: UP_COLOR,
            borderColor0: DOWN_COLOR,
          },
        },
        { name: 'MA5', type: 'line', data: ma5, smooth: true, symbol: 'none', lineStyle: { width: 1.2, color: '#f59e0b' }, itemStyle: { color: '#f59e0b' } },
        { name: 'MA20', type: 'line', data: ma20, smooth: true, symbol: 'none', lineStyle: { width: 1.2, color: '#3b82f6' }, itemStyle: { color: '#3b82f6' } },
        { name: 'MA60', type: 'line', data: ma60, smooth: true, symbol: 'none', lineStyle: { width: 1.2, color: '#a855f7' }, itemStyle: { color: '#a855f7' } },
        {
          name: 'MACD',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          barWidth: '58%',
          data: macd.map(value => ({
            value,
            itemStyle: { color: value >= 0 ? UP_COLOR : DOWN_COLOR },
          })),
        },
        { name: 'DIF', type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: dif, symbol: 'none', lineStyle: { width: 1.2, color: '#3b82f6' }, itemStyle: { color: '#3b82f6' } },
        { name: 'DEA', type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: dea, symbol: 'none', lineStyle: { width: 1.2, color: '#f59e0b' }, itemStyle: { color: '#f59e0b' } },
        {
          name: 'RSI(6)',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: rsi6,
          symbol: 'none',
          lineStyle: { width: 1.2, color: '#3b82f6' },
          itemStyle: { color: '#3b82f6' },
        },
        {
          name: 'RSI(14)',
          type: 'line',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: rsi14,
          symbol: 'none',
          lineStyle: { width: 1.2, color: '#f59e0b' },
          itemStyle: { color: '#f59e0b' },
          markLine: {
            silent: true,
            animation: false,
            symbol: 'none',
            data: [
              { yAxis: 70, lineStyle: { color: UP_COLOR, type: 'dashed', width: 1 }, label: { show: false } },
              { yAxis: 30, lineStyle: { color: DOWN_COLOR, type: 'dashed', width: 1 }, label: { show: false } },
            ],
          },
        },
        {
          name: '回撤',
          type: 'line',
          xAxisIndex: 3,
          yAxisIndex: 3,
          data: drawdown,
          symbol: 'none',
          lineStyle: { width: 1.3, color: '#ef4444' },
          itemStyle: { color: '#ef4444' },
          areaStyle: {
            color: {
              type: 'linear' as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(239,68,68,0.25)' },
                { offset: 1, color: 'rgba(239,68,68,0)' },
              ],
            },
          },
        },
      ],
    };

    const currentSignal = signalMode === 'found' && signals.length > 0 ? signals[Math.min(currentSignalIdx, signals.length - 1)] : null;

    // 信号标注：found 模式时在当前信号位置添加标记
    if (signalMode === 'found' && signals.length > 0) {
      const signal = signals[0];
      const candle = ohlc[signal.index];
      if (candle) {
        const isBearish = isBearishSignal(signal.type);
        const position = isBearish ? 'top' : 'bottom';
        const posVal = position === 'bottom' ? candle.low : candle.high;
        const sigDesc = SIGNAL_DESC[signal.type] || signal.label;
        const color = signalDisplayColor(signal.type);
        (opt.series as Record<string, unknown>[]).push({
          name: '信号标注',
          type: 'scatter',
          data: [{
            value: [dates[signal.index], posVal],
            itemStyle: { color, borderColor: '#fff', borderWidth: 2 },
            label: {
              show: true,
              position,
              distance: 10,
              color: '#111827',
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: 'rgba(255,255,255,0.94)',
              borderColor: color,
              borderWidth: 1,
              borderRadius: 6,
              padding: [3, 6],
              formatter: signal.label,
            },
          }],
          symbol: 'circle',
          symbolSize: 12,
          z: 20,
          tooltip: {
            show: true,
            trigger: 'item' as const,
            formatter: () => `<div style="max-width:260px;font-size:12px;line-height:1.6;word-break:break-word;overflow-wrap:break-word;white-space:normal"><b style="color:${color}">${signal.label}</b><br/>${sigDesc}</div>`,
            extraCssText: 'border-radius:10px;padding:10px 12px;box-shadow:0 4px 16px rgba(0,0,0,0.1);max-width:280px !important;',
          },
        });
      }
    }

    return opt;
  }, [ohlc, selectedRange, signalMode, signals]);

  const holdingOption = useMemo(() => {
    if (!data?.holding.length) return null;

    const palette = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#f97316', '#ec4899', '#6366f1', '#14b8a6'];

    return {
      tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const } },
      grid: { left: '22%', right: '5%', top: '6%', bottom: '8%' },
      xAxis: {
        type: 'value' as const,
        axisLabel: { color: AXIS_COLOR, fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { type: 'dashed' as const, color: GRID_COLOR } },
      },
      yAxis: {
        type: 'category' as const,
        data: data.holding.map(item => item.name).reverse(),
        axisLabel: { color: '#475569', fontSize: 11 },
      },
      series: [{
        type: 'bar' as const,
        data: data.holding.map(item => item.weight).reverse(),
        barWidth: '55%',
        itemStyle: {
          color: (params: { dataIndex: number }) => palette[params.dataIndex % palette.length],
          borderRadius: [0, 4, 4, 0],
        },
      }],
    };
  }, [data]);

  const analysisSections = useMemo(() => data ? buildAnalysis(data) : [], [data]);
  const selectionCursorPct = cursorPct ?? 50;

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] page-enter">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-[14px] text-gray-400">正在加载基金数据...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-[15px] text-gray-500 mb-4">数据加载失败</p>
        <Link href="/watchlist" className="text-[13px] text-blue-500 hover:text-blue-600 transition-colors">
          返回自选
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 page-enter pb-10">
      <Link href="/watchlist" className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-900 transition-colors">
        <ArrowLeft size={14} />
        返回自选
      </Link>

      <div className="bg-gray-50 rounded-2xl p-5 border border-black/[0.04] flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">{data.name}</h1>
          <p className="text-[12px] text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{data.code}</span>
            {data.type && data.type !== '未知' && <span>· {data.type}</span>}
            {data.sectors && data.sectors.length > 0 && data.sectors.map((sector, i) => {
              const colors = [
                'bg-blue-50 text-blue-600',
                'bg-amber-50 text-amber-600',
                'bg-purple-50 text-purple-600',
                'bg-green-50 text-green-600',
                'bg-red-50 text-red-600',
                'bg-cyan-50 text-cyan-600',
                'bg-pink-50 text-pink-600',
                'bg-indigo-50 text-indigo-600',
              ];
              return (
                <span key={sector} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors[i % colors.length]}`}>
                  {sector}
                </span>
              );
            })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[26px] font-semibold tabular-nums">{data.nav.toFixed(4)}</p>
          <div className={`flex items-center justify-end gap-1 ${data.dailyChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
            {data.dailyChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span className="text-[14px] font-semibold tabular-nums">
              {data.dailyChange >= 0 ? '+' : '-'}
              {Math.abs(data.dailyChange).toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl border border-black/[0.04] p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[14px] font-semibold">图表分析</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">净值K线、MACD、RSI、回撤垂直联动展示</p>
          </div>
          <div className="flex items-center gap-1">
            {[
              { label: '近1月', value: '1m' },
              { label: '近3月', value: '3m' },
              { label: '近6月', value: '6m' },
              { label: '近1年', value: '1y' },
              { label: '近3年', value: '3y' },
              { label: '成立以来', value: 'all' },
            ].map(range => (
              <button
                key={range.value}
                onClick={() => {
                  setSelectedRange(range.value);
                  if (chartRef.current) {
                    const total = ohlc.length;
                    const start = rangeToStart(range.value, total);
                    trackZoomWindow(start, 100);
                    chartRef.current.dispatchAction({ type: 'dataZoom', start, end: 100 });
                  }
                }}
                className={`px-2.5 py-1 text-[11px] rounded-lg transition-colors ${
                  selectedRange === range.value
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-500 hover:bg-black/[0.04]'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {/* 关键信号查找 */}
        <div className="flex items-center justify-between mb-3">
          <div>
            {signalMode === 'found' && currentSignal && (
              <span className="text-[11px] text-gray-500">
                信号 {currentSignalIdx + 1}/{signals.length}：<span className="font-semibold" style={{ color: signalDisplayColor(currentSignal.type) }}>{currentSignal.label}</span>
              </span>
            )}
            {signalMode === 'selecting' && (
              <span className="text-[11px] text-blue-500">鼠标在图表上移动选择起始日期，点击确认</span>
            )}
            {signalMode === 'idle' && (
              <span className="text-[11px] text-gray-400">查找K线形态、均线交叉、MACD信号等技术形态</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {signalMode === 'idle' && (
              <button
                onClick={enterSignalMode}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
              >
                <Search size={12} />寻找关键信号
              </button>
            )}
            {signalMode === 'found' && (
              <>
                <button
                  onClick={findPrevSignal}
                  className="flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                >
                  <ChevronRight size={12} className="rotate-180" />上一个
                </button>
                <button
                  onClick={findNextSignal}
                  className="flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 transition-colors"
                >
                  下一个 <ChevronRight size={12} />
                </button>
                <button
                  onClick={exitSignalMode}
                  className="flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-lg text-gray-500 hover:bg-black/[0.04] transition-colors"
                >
                  <X size={12} />取消
                </button>
              </>
            )}
            {signalMode === 'selecting' && (
              <button
                onClick={exitSignalMode}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] rounded-lg text-gray-500 hover:bg-black/[0.04] transition-colors"
              >
                <X size={12} />取消
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          {technicalOption ? (
            <div ref={chartContainerRef as React.RefObject<HTMLDivElement>} className="relative">
              <ReactECharts
                option={technicalOption}
                notMerge
                onEvents={{ datazoom: handleChartDataZoom }}
                onChartReady={instance => {
                  const echartsInstance = instance as unknown as EChartsInstance;
                  chartRef.current = echartsInstance;
                  const total = ohlc.length;
                  if (total && !hasTrackedZoomRef.current) {
                    const initStart = rangeToStart(selectedRange, total);
                    trackZoomWindow(initStart, 100);
                    echartsInstance.dispatchAction({ type: 'dataZoom', start: initStart, end: 100 });
                  }
                }}
                style={{ height: 1050 }}
              />
              {/* 选择模式捕获层：拦截 ECharts tooltip，同时用 CSS 蒙版保持移动丝滑 */}
              {signalMode === 'selecting' && (
                <div
                  className="absolute inset-0 z-10 cursor-crosshair overflow-hidden rounded-2xl"
                  style={{ height: 'calc(100% - 22px)', touchAction: 'none' }}
                  onPointerMove={handleSelectionPointerMove}
                  onMouseMove={handleSelectionMouseMove}
                  onClick={handleSelectionClick}
                  onPointerLeave={handleSelectionPointerLeave}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `linear-gradient(to right,
                        rgba(180,190,200,0.55) 0%,
                        rgba(180,190,200,0.55) calc(${selectionCursorPct}% - ${SIGNAL_CLEAR_STRIP / 2}px),
                        transparent calc(${selectionCursorPct}% - ${SIGNAL_CLEAR_STRIP / 2}px),
                        transparent calc(${selectionCursorPct}% + ${SIGNAL_CLEAR_STRIP / 2}px),
                        rgba(180,190,200,0.55) calc(${selectionCursorPct}% + ${SIGNAL_CLEAR_STRIP / 2}px),
                        rgba(180,190,200,0.55) 100%)`,
                    }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.5)]"
                    style={{ left: `${selectionCursorPct}%` }}
                  />
                  <div
                    className="absolute top-3 -translate-x-1/2 px-2 py-1 bg-white/95 rounded-md border border-blue-400 text-[11px] font-semibold text-blue-600 whitespace-nowrap shadow-sm"
                    style={{ left: `${selectionCursorPct}%` }}
                  >
                    点击选定此日期
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[520px] rounded-xl bg-white border border-black/[0.04] flex items-center justify-center">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[12px] text-gray-400">正在加载图表数据...</span>
              </div>
            </div>
          )}
          {/* 指标说明浮标 */}
          {technicalOption && [
            { id: 'macd', label: 'MACD', top: '50.5%', left: 48, desc: 'MACD 通过 DIF 与 DEA 两条线的交叉来判断趋势和买卖信号。金叉（DIF 上穿 DEA）为看涨信号，死叉为看跌信号。' },
            { id: 'rsi', label: 'RSI', top: '63.5%', left: 36, desc: 'RSI（相对强弱指标）衡量价格上涨和下跌的相对强度。通常 70 以上为超买区，30 以下为超卖区。' },
            { id: 'dd', label: '回撤', top: '79.5%', left: 36, desc: '回撤是从历史最高点到当前净值的下跌幅度，反映基金在最不利情况下的亏损程度。回撤越小，风险控制越好。' },
          ].map(item => (
            <div key={item.id} className="absolute" style={{ top: item.top, left: item.left, transform: 'translateY(-50%)' }}>
              <span className="group inline-flex items-center justify-center w-[15px] h-[15px] rounded-full bg-gray-200/80 text-gray-400 text-[8px] cursor-help hover:bg-blue-100 hover:text-blue-500 transition-colors select-none relative">?
                <span className="invisible group-hover:visible absolute left-5 top-1/2 -translate-y-1/2 z-50 w-64 p-3 bg-white rounded-xl shadow-lg border border-black/[0.06] text-left cursor-default">
                  <span className="block text-[12px] font-semibold text-gray-800 mb-1">{item.label}</span>
                  <span className="block text-[11px] text-gray-500 leading-relaxed">{item.desc}</span>
                  <Link href="/academy" className="text-[10px] text-blue-500 hover:text-blue-600 mt-1.5 inline-block">前往 K 线学院学习 →</Link>
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 max-lg:grid-cols-1">
        <div className="bg-gray-50 rounded-2xl border border-black/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={15} className="text-amber-500" />
            <h3 className="text-[14px] font-semibold">风险指标</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '最大回撤', value: `${data.risk.maxDrawdown.toFixed(1)}%`, color: 'text-red-500' },
              { label: '年化波动率', value: `${data.risk.volatility.toFixed(1)}%`, color: 'text-amber-500' },
              { label: '夏普比率', value: data.risk.sharpe.toFixed(2), color: data.risk.sharpe > 0.5 ? 'text-green-500' : 'text-red-500' },
              { label: '卡玛比率', value: data.risk.calmar.toFixed(2), color: data.risk.calmar > 0.5 ? 'text-green-500' : 'text-red-500' },
              { label: '年化收益', value: `${(data.risk.annualReturn || 0).toFixed(1)}%`, color: (data.risk.annualReturn || 0) >= 0 ? 'text-red-500' : 'text-green-500' },
            ].map(item => (
              <div key={item.label} className="p-3 bg-white rounded-xl border border-black/[0.04]">
                <p className="text-[10px] text-gray-400 mb-1">{item.label}</p>
                <p className={`text-[16px] font-semibold tabular-nums ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 rounded-2xl border border-black/[0.04] p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={15} className="text-purple-500" />
            <h3 className="text-[14px] font-semibold">重仓持股</h3>
          </div>
          {holdingOption ? (
            <ReactECharts option={holdingOption} style={{ height: Math.max(220, data.holding.length * 28) }} />
          ) : (
            <p className="text-[12px] text-gray-400 text-center py-8">暂无持仓数据</p>
          )}
        </div>
      </div>

      <div className="bg-gray-50 rounded-2xl border border-black/[0.04]">
        <button
          onClick={() => setShowAI(!showAI)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-black/[0.02] transition-colors rounded-2xl"
        >
          <div className="flex items-center gap-2">
            <Brain size={15} className="text-indigo-500" />
            <h3 className="text-[14px] font-semibold">AI 智能分析</h3>
          </div>
          {showAI ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {showAI && (
          <div className="px-5 pb-5 space-y-4 border-t border-black/[0.04] pt-4">
            {analysisSections.map((section) => (
              <div key={section.title}>
                <p className={`text-[12px] font-semibold mb-1.5 ${section.color}`}>{section.icon} {section.title}</p>
                <div className="space-y-1">
                  {section.items.map((item, i) => (
                    <p key={i} className="text-[13px] text-gray-600 leading-relaxed">{item}</p>
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
              <span className="text-[14px] flex-shrink-0">⚠️</span>
              <div className="text-[11px] text-amber-800 leading-relaxed">
                <p className="font-semibold mb-0.5">免责声明</p>
                <p>本页面所有分析内容（技术指标、风险评估、持仓分析、综合评估等）均基于历史数据的统计计算，<strong>不构成任何投资建议</strong>。历史表现不代表未来收益，技术指标存在滞后性和失效可能，市场受政策、情绪、突发事件等多重因素影响。<strong>请勿将本工具的分析结论作为买卖决策依据</strong>，投资有风险，入市须谨慎。</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
