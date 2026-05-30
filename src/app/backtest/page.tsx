'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft,
  BookOpenText,
  CalendarClock,
  FolderPlus,
  LineChart,
  PencilLine,
  Plus,
  RefreshCcw,
  Trash2,
} from 'lucide-react';
import {
  type InputMode,
  type InvestmentPlan,
  type PlanMode,
  type SimulationFund,
  summarizeFund,
  summarizeGroup,
  useInvestmentSimulation,
} from '@/lib/useInvestmentSimulation';

const TAGS = ['冷静', '焦虑', '犹豫', '有信心', '追涨冲动', '恐慌', '信心增强'];

function formatWithCommas(raw: string): string {
  if (!raw) return '';
  const [intPart, decPart] = raw.split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

function parseFormatted(value: string): string {
  return value.replace(/,/g, '');
}

function FormattedAmountInput({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  function handleChange(e: FormEvent<HTMLInputElement>) {
    if (composingRef.current) return;
    const el = e.currentTarget;
    const cursorPos = el.selectionStart ?? 0;
    const prevFormatted = el.value;
    const commasBefore = (prevFormatted.slice(0, cursorPos).match(/,/g) || []).length;

    const raw = parseFormatted(el.value).replace(/[^\d.]/g, '');
    const clean = raw.indexOf('.') !== -1
      ? raw.slice(0, raw.indexOf('.') + 1) + raw.slice(raw.indexOf('.') + 1).replace(/\./g, '')
      : raw;
    const formatted = formatWithCommas(clean);

    const newCommasBefore = (formatted.slice(0, cursorPos + (formatted.length - prevFormatted.length)).match(/,/g) || []).length;
    const newPos = Math.min(cursorPos + (formatted.length - prevFormatted.length) + (newCommasBefore - commasBefore), formatted.length);

    onChange(clean);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.value = formatted;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    });
  }

  return (
    <input
      ref={inputRef}
      defaultValue={formatWithCommas(value)}
      onInput={handleChange}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={(e) => { composingRef.current = false; handleChange(e as unknown as FormEvent<HTMLInputElement>); }}
      type="text"
      inputMode="decimal"
      placeholder={placeholder}
      className={className}
    />
  );
}
const PLAN_LABEL: Record<PlanMode, string> = {
  none: '未设置',
  'one-time': '一次性投入',
  daily: '每日定投',
  weekly: '每周定投',
  monthly: '每月定投',
};

interface ApiFundQuote {
  code: string;
  name: string;
  type?: string;
  nav?: number;
  date?: string;
  navDate?: string;
  dailyChange?: number;
}

type ActionType = 'buy' | 'sell' | 'convert' | 'observe' | 'plan';

function money(value: number) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function percent(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function BacktestPage() {
  const {
    store,
    createGroup,
    updateFundPlan,
    recordManualBuy,
    recordOneTime,
    recordManualSell,
    recordConversion,
    recordObservation,
    removeFundFromGroup,
    refreshFundQuotes,
  } = useInvestmentSimulation();

  const [activeGroupId, setActiveGroupId] = useState(() => {
    if (typeof window === 'undefined') return 'all';
    return new URLSearchParams(window.location.search).get('group') ?? 'all';
  });
  const [newGroupName, setNewGroupName] = useState('');
  const [activeAction, setActiveAction] = useState<{ type: ActionType; fund: SimulationFund } | null>(null);
  const [amount, setAmount] = useState('');
  const [shares, setShares] = useState('');
  const [inputMode, setInputMode] = useState<InputMode>('amount');
  const [targetFundId, setTargetFundId] = useState('');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [planMode, setPlanMode] = useState<PlanMode>('weekly');
  const [planAmount, setPlanAmount] = useState('');
  const [planStartDate, setPlanStartDate] = useState(today());
  const [refreshing, setRefreshing] = useState(false);

  const activeFunds = useMemo(() => {
    if (activeGroupId === 'all') return store.funds;
    return store.funds.filter(fund => fund.groupId === activeGroupId);
  }, [activeGroupId, store.funds]);

  const activeLogs = useMemo(() => {
    if (activeGroupId === 'all') return store.logs;
    return store.logs.filter(log => log.groupId === activeGroupId);
  }, [activeGroupId, store.logs]);

  const groupSummary = useMemo(() => summarizeGroup(activeFunds, activeLogs), [activeFunds, activeLogs]);
  const fundSummaries = useMemo(() => activeFunds.map(summarizeFund), [activeFunds]);
  const activeGroupName = activeGroupId === 'all'
    ? '全部模拟'
    : store.groups.find(group => group.id === activeGroupId)?.name ?? '模拟分组';
  const simulationCodes = useMemo(() => Array.from(new Set(store.funds.map(fund => fund.code))), [store.funds]);
  const simulationCodesKey = simulationCodes.join('|');

  const review = useMemo(() => {
    const actionLogs = activeLogs.filter(log => log.action !== 'plan-change');
    const autoCount = activeLogs.filter(log => log.action === 'auto-invest').length;
    const tagCounts = activeLogs.flatMap(log => log.tags).reduce<Record<string, number>>((acc, tag) => {
      acc[tag] = (acc[tag] ?? 0) + 1;
      return acc;
    }, {});
    const topTag = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0];
    const largestImpact = [...fundSummaries].sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))[0];
    return {
      actionCount: actionLogs.length,
      autoCount,
      topTag: topTag ? `${topTag[0]} ${topTag[1]} 次` : '暂无标签',
      largestImpact: largestImpact ? `${largestImpact.name} ${money(largestImpact.pnl)} 元` : '暂无数据',
    };
  }, [activeLogs, fundSummaries]);

  function doRefresh() {
    const codes = simulationCodesKey ? simulationCodesKey.split('|') : [];
    if (codes.length === 0) return;
    setRefreshing(true);
    fetch('/api/funds?page=1&size=10000&sort=yearChange&order=desc')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data.funds) ? data.funds as ApiFundQuote[] : [];
        const byCode = new Map(list.map(item => [item.code, item]));
        const quotes: ApiFundQuote[] = [];
        const missing: string[] = [];

        codes.forEach(code => {
          const item = byCode.get(code);
          if (item) {
            quotes.push({
              code: item.code,
              name: item.name,
              type: item.type,
              nav: item.nav,
              navDate: item.navDate ?? item.date,
              dailyChange: item.dailyChange,
            });
          } else {
            missing.push(code);
          }
        });

        if (quotes.length > 0) refreshFundQuotes(quotes);

        // 兜底：批量 API 中没有的基金，单独请求
        missing.forEach(code => {
          fetch(`/api/fund/${code}/analyze`)
            .then(r => r.json())
            .then(detail => {
              if (detail.error) return;
              const nav = Number(detail.nav ?? 0);
              const quote: ApiFundQuote = {
                code,
                name: detail.name ?? code,
                type: detail.type ?? '',
                nav,
                navDate: detail.navDate ?? '',
                dailyChange: detail.dailyChange ?? 0,
              };
              if (nav > 0) refreshFundQuotes([quote]);
            })
            .catch(() => {});
        });
      })
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    doRefresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulationCodesKey]);

  function createNamedGroup(event: FormEvent) {
    event.preventDefault();
    const group = createGroup(newGroupName);
    if (group) {
      setActiveGroupId(group.id);
      setNewGroupName('');
    }
  }

  function openAction(type: ActionType, fund: SimulationFund) {
    setActiveAction({ type, fund });
    setAmount('');
    setShares('');
    setInputMode('amount');
    setTargetFundId('');
    setNote('');
    setTags([]);
    setPlanMode(fund.plan.mode === 'one-time' ? 'weekly' : fund.plan.mode === 'none' ? 'weekly' : fund.plan.mode);
    setPlanAmount(fund.plan.amount ? String(fund.plan.amount) : '');
    setPlanStartDate(fund.plan.startDate || today());
  }

  function closeAction() {
    setActiveAction(null);
  }

  function toggleTag(tag: string) {
    setTags(current => current.includes(tag) ? current.filter(item => item !== tag) : [...current, tag]);
  }

  function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!activeAction) return;
    const fund = activeAction.fund;
    const numericAmount = Number(amount);
    const numericShares = Number(shares);

    if (activeAction.type === 'buy') {
      if (numericAmount > 0) recordManualBuy(fund.id, numericAmount, note, tags);
    }

    if (activeAction.type === 'sell') {
      const value = inputMode === 'amount' ? numericAmount : numericShares;
      if (value > 0) recordManualSell(fund.id, value, inputMode, note, tags);
    }

    if (activeAction.type === 'convert') {
      const value = inputMode === 'amount' ? numericAmount : numericShares;
      if (targetFundId && value > 0) recordConversion(fund.id, targetFundId, value, inputMode, note, tags);
    }

    if (activeAction.type === 'observe') {
      if (note.trim() || tags.length > 0) recordObservation(fund.id, note, tags);
    }

    if (activeAction.type === 'plan') {
      const cleanAmount = Number(planAmount);
      if (planMode === 'one-time' && cleanAmount > 0) {
        recordOneTime(fund.id, cleanAmount, note, tags);
      } else {
        const plan: InvestmentPlan = {
          mode: planMode,
          amount: cleanAmount > 0 ? cleanAmount : 0,
          startDate: planStartDate || today(),
          lastExecutedNavDate: fund.plan.lastExecutedNavDate,
          enabled: planMode !== 'none' && cleanAmount > 0,
        };
        updateFundPlan(fund.id, plan, note);
      }
    }

    closeAction();
  }

  function setQuickRatio(ratio: number) {
    setInputMode('ratio');
    setShares(String(ratio));
  }

  const conversionTargets = activeAction
    ? store.funds.filter(fund => fund.groupId === activeAction.fund.groupId && fund.id !== activeAction.fund.id)
    : [];

  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">投资模拟</h1>
          <p className="mt-1 text-[13px] text-gray-400">
            从今天开始记录纸上投资，用真实净值追踪投入、卖出、转换和观察笔记。
          </p>
        </div>
        <Link
          href="/funds"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-blue-600"
        >
          <FolderPlus size={15} />
          从基金筛选加入
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ['总投入', `¥${money(groupSummary.totalInvested)}`],
          ['当前市值', `¥${money(groupSummary.currentValue)}`],
          ['累计收益', `¥${money(groupSummary.pnl)}`],
          ['收益率', percent(groupSummary.returnRate)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-black/[0.04] bg-gray-50 p-4">
            <p className="text-[11px] text-gray-400">{label}</p>
            <p className={`mt-2 text-[22px] font-semibold tabular-nums ${label === '累计收益' && groupSummary.pnl < 0 ? 'text-green-500' : label === '累计收益' && groupSummary.pnl > 0 ? 'text-red-500' : 'text-gray-900'}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.04] bg-gray-50 p-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveGroupId('all')}
            className={`rounded-xl px-3 py-2 text-[12px] font-medium transition-colors ${activeGroupId === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
          >
            全部
          </button>
          {store.groups.map(group => (
            <button
              key={group.id}
              onClick={() => setActiveGroupId(group.id)}
              className={`rounded-xl px-3 py-2 text-[12px] font-medium transition-colors ${activeGroupId === group.id ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-100'}`}
            >
              {group.name}
            </button>
          ))}
        </div>
        <form onSubmit={createNamedGroup} className="flex min-w-0 gap-2">
          <input
            value={newGroupName}
            onChange={event => setNewGroupName(event.target.value)}
            placeholder="新建模拟分组"
            className="min-w-0 rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-[12px] outline-none focus:border-blue-300"
          />
          <button className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-[12px] font-medium text-gray-700 transition-colors hover:bg-gray-100">
            <Plus size={13} />
            新建
          </button>
        </form>
      </div>

      {activeFunds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <LineChart size={42} className="mx-auto mb-4 text-gray-200" />
          <h2 className="text-[17px] font-semibold text-gray-700">{activeGroupName}暂无基金</h2>
          <p className="mt-2 text-[13px] text-gray-400">去基金筛选页或自选页点击“加入模拟”，把基金放进模拟分组。</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[17px] font-semibold">{activeGroupName}</h2>
            <button
              type="button"
              onClick={doRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            >
              <RefreshCcw size={13} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? '刷新中...' : '刷新净值'}
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-black/[0.04] bg-gray-50">
            <div className="grid grid-cols-12 gap-3 border-b border-black/[0.04] px-4 py-2.5 text-[11px] uppercase tracking-wider text-gray-400">
              <span className="col-span-3">基金</span>
              <span className="col-span-1 text-right">净值</span>
              <span className="col-span-1 text-right">份额</span>
              <span className="col-span-2 text-right">市值</span>
              <span className="col-span-2 text-right">收益</span>
              <span className="col-span-1 text-center">计划</span>
              <span className="col-span-2 text-right">操作</span>
            </div>
            <div className="divide-y divide-black/[0.04]">
              {fundSummaries.map(fund => (
                <div key={fund.id} className="grid grid-cols-12 gap-3 px-4 py-3 text-[13px]">
                  <div className="col-span-3 min-w-0">
                    <p className="truncate font-medium text-gray-900">{fund.name}</p>
                    <p className="mt-1 text-[11px] text-gray-400">{fund.code} · {fund.latestNavDate || '暂无净值日期'}</p>
                  </div>
                  <span className="col-span-1 text-right font-mono tabular-nums">{fund.latestNav > 0 ? fund.latestNav.toFixed(4) : '-'}</span>
                  <span className="col-span-1 text-right tabular-nums">{fund.shares.toFixed(2)}</span>
                  <span className="col-span-2 text-right tabular-nums">¥{money(fund.currentValue)}</span>
                  <span className={`col-span-2 text-right font-semibold tabular-nums ${fund.pnl >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                    ¥{money(fund.pnl)} · {percent(fund.returnRate)}
                  </span>
                  <span className="col-span-1 text-center">
                    <button onClick={() => openAction('plan', fund)} className="rounded-lg bg-white px-2 py-1 text-[11px] text-blue-600 hover:bg-blue-50">
                      {PLAN_LABEL[fund.plan.mode]}
                    </button>
                  </span>
                  <span className="col-span-2 flex flex-wrap justify-end gap-1">
                    <button onClick={() => openAction('buy', fund)} className="rounded-lg bg-red-50 px-2 py-1 text-[11px] text-red-500">买入</button>
                    <button onClick={() => openAction('sell', fund)} className="rounded-lg bg-green-50 px-2 py-1 text-[11px] text-green-600">卖出</button>
                    <button onClick={() => openAction('convert', fund)} className="rounded-lg bg-indigo-50 px-2 py-1 text-[11px] text-indigo-600">转换</button>
                    <button onClick={() => openAction('observe', fund)} className="rounded-lg bg-white px-2 py-1 text-[11px] text-gray-500">观察</button>
                    <button onClick={() => removeFundFromGroup(fund.id)} className="rounded-lg bg-white p-1 text-gray-300 hover:text-red-400">
                      <Trash2 size={12} />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-black/[0.04] bg-gray-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <BookOpenText size={16} className="text-gray-400" />
            <h2 className="text-[15px] font-semibold">操作日志</h2>
          </div>
          {activeLogs.length === 0 ? (
            <p className="rounded-xl bg-white p-5 text-center text-[13px] text-gray-400">暂无操作记录。</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {activeLogs.map(log => (
                <div key={log.id} className="rounded-xl bg-white p-3 text-[12px]">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-gray-800">{log.fundName} · {log.action}</p>
                    <p className="text-[11px] text-gray-400">{log.navDate || log.createdAt.slice(0, 10)}</p>
                  </div>
                  <p className="mt-1 text-gray-500">
                    {log.amount > 0 && `金额 ¥${money(log.amount)} `}
                    {log.shares > 0 && `份额 ${log.shares.toFixed(4)} `}
                    {log.targetFundName && `转入 ${log.targetFundName}`}
                  </p>
                  {(log.note || log.tags.length > 0) && (
                    <p className="mt-2 text-gray-400">
                      {log.tags.length > 0 && `[${log.tags.join('、')}] `}
                      {log.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-black/[0.04] bg-gray-50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <PencilLine size={16} className="text-gray-400" />
            <h2 className="text-[15px] font-semibold">规则化复盘</h2>
          </div>
          <div className="grid gap-2 text-[12px]">
            <div className="rounded-xl bg-white p-3">
              <p className="text-gray-400">记录密度</p>
              <p className="mt-1 font-medium text-gray-800">已记录 {review.actionCount} 次操作</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-gray-400">定投纪律</p>
              <p className="mt-1 font-medium text-gray-800">自动定投 {review.autoCount} 次</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-gray-400">高频状态</p>
              <p className="mt-1 font-medium text-gray-800">{review.topTag}</p>
            </div>
            <div className="rounded-xl bg-white p-3">
              <p className="text-gray-400">最大影响</p>
              <p className="mt-1 font-medium text-gray-800">{review.largestImpact}</p>
            </div>
          </div>
        </section>
      </div>

      {activeAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4">
          <form onSubmit={submitAction} className="w-full max-w-lg rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{activeAction.fund.name}</p>
                <h3 className="mt-1 text-[17px] font-semibold text-gray-900">
                  {activeAction.type === 'plan' && '配置投入方式'}
                  {activeAction.type === 'buy' && '手动买入'}
                  {activeAction.type === 'sell' && '手动卖出'}
                  {activeAction.type === 'convert' && '转换到其他基金'}
                  {activeAction.type === 'observe' && '记录观察'}
                </h3>
              </div>
              <button type="button" onClick={closeAction} className="rounded-lg p-1.5 text-gray-300 hover:bg-gray-50 hover:text-gray-600">关闭</button>
            </div>

            {activeAction.type === 'plan' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {(['one-time', 'daily', 'weekly', 'monthly', 'none'] as PlanMode[]).map(mode => (
                    <button
                      type="button"
                      key={mode}
                      onClick={() => setPlanMode(mode)}
                      className={`rounded-xl border px-3 py-2 text-[12px] ${planMode === mode ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-black/[0.06] text-gray-500'}`}
                    >
                      {PLAN_LABEL[mode]}
                    </button>
                  ))}
                </div>
                <FormattedAmountInput key={`plan-${activeAction?.fund.id}`} value={planAmount} onChange={setPlanAmount} placeholder="金额" className="w-full rounded-xl border border-black/[0.06] px-3 py-2 text-[13px]" />
                <input value={planStartDate} onChange={event => setPlanStartDate(event.target.value)} type="date" className="w-full rounded-xl border border-black/[0.06] px-3 py-2 text-[13px]" />
              </div>
            )}

            {(activeAction.type === 'buy' || activeAction.type === 'sell' || activeAction.type === 'convert') && (
              <div className="space-y-3">
                {(activeAction.type === 'sell' || activeAction.type === 'convert') && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setInputMode('amount')} className={`rounded-xl px-3 py-2 text-[12px] ${inputMode === 'amount' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-500'}`}>按金额</button>
                    <button type="button" onClick={() => setInputMode('shares')} className={`rounded-xl px-3 py-2 text-[12px] ${inputMode === 'shares' ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-500'}`}>按份额</button>
                    <button type="button" onClick={() => setQuickRatio(1 / 3)} className="rounded-xl bg-gray-50 px-3 py-2 text-[12px] text-gray-500">1/3</button>
                    <button type="button" onClick={() => setQuickRatio(1 / 2)} className="rounded-xl bg-gray-50 px-3 py-2 text-[12px] text-gray-500">1/2</button>
                    <button type="button" onClick={() => setQuickRatio(1)} className="rounded-xl bg-gray-50 px-3 py-2 text-[12px] text-gray-500">全部</button>
                  </div>
                )}
                {inputMode === 'amount' ? (
                  <FormattedAmountInput key={`amount-${activeAction?.fund.id}-${activeAction?.type}`} value={amount} onChange={setAmount} placeholder="金额" className="w-full rounded-xl border border-black/[0.06] px-3 py-2 text-[13px]" />
                ) : (
                  <input value={shares} onChange={event => setShares(event.target.value)} type="number" min="0" step="0.0001" placeholder={inputMode === 'ratio' ? '快捷比例已选择' : '份额'} className="w-full rounded-xl border border-black/[0.06] px-3 py-2 text-[13px]" />
                )}
                {activeAction.type === 'convert' && (
                  <select value={targetFundId} onChange={event => setTargetFundId(event.target.value)} className="w-full rounded-xl border border-black/[0.06] px-3 py-2 text-[13px]">
                    <option value="">选择转入基金</option>
                    {conversionTargets.map(fund => <option key={fund.id} value={fund.id}>{fund.name}</option>)}
                  </select>
                )}
              </div>
            )}

            <textarea
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder="记录当时为什么这样做，或者为什么选择不操作"
              className="mt-3 min-h-24 w-full rounded-xl border border-black/[0.06] px-3 py-2 text-[13px]"
            />

            <div className="mt-3 flex flex-wrap gap-2">
              {TAGS.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full px-3 py-1.5 text-[11px] ${tags.includes(tag) ? 'bg-blue-500 text-white' : 'bg-gray-50 text-gray-500'}`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closeAction} className="rounded-xl border border-black/[0.06] px-4 py-2 text-[12px] font-medium text-gray-500">取消</button>
              <button className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-[12px] font-medium text-white hover:bg-blue-600">
                {activeAction.type === 'convert' && <ArrowRightLeft size={13} />}
                {activeAction.type === 'plan' && <CalendarClock size={13} />}
                保存
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
