'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LEARNING_CARDS } from '@/data/mock-kline';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react';

interface ApiFund {
  code: string;
  name: string;
  type: string;
  nav: number;
  dailyChange: number;
}

interface ApiIndex {
  name: string;
  code: string;
  value: number;
  change: number;
  market?: string;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-5 border border-black/[0.04]">
      <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function MarketCard({ index }: { index: ApiIndex }) {
  const isUp = index.change >= 0;

  return (
    <div className="bg-gray-50 rounded-2xl p-5 border border-black/[0.04] hover:border-black/[0.08] transition-colors duration-200">
      <p className="text-[11px] text-gray-400 mb-2">{index.name}</p>
      <p className="text-xl font-semibold tracking-tight tabular-nums">
        {index.value.toLocaleString()}
      </p>
      <div className="flex items-center gap-1 mt-1.5">
        {isUp ? <ArrowUpRight size={12} className="text-red-500" /> : <ArrowDownRight size={12} className="text-green-500" />}
        <span className={`text-[13px] font-medium tabular-nums ${isUp ? 'text-red-500' : 'text-green-500'}`}>
          {isUp ? '+' : ''}
          {index.change.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

function LearningTip() {
  const [cardIndex, setCardIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const card = LEARNING_CARDS[cardIndex];

  return (
    <div className="bg-gray-50 rounded-2xl p-6 border border-black/[0.04]">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[15px] font-semibold tracking-tight">每日一学</h3>
        <span className="text-[11px] px-2.5 py-1 rounded-full bg-black/[0.04] text-gray-500">
          {card.category}
        </span>
      </div>

      <h4 className="text-[14px] font-medium mb-3">{card.title}</h4>
      <p className="text-[13px] text-gray-500 leading-relaxed mb-5">{card.content}</p>

      {card.quiz && (
        <div className="p-4 bg-white rounded-xl border border-black/[0.04]">
          <p className="text-[13px] font-medium mb-3">{card.quiz.question}</p>
          <div className="space-y-2">
            {card.quiz.options.map((opt, index) => (
              <button
                key={index}
                onClick={() => setSelectedAnswer(index)}
                className={`w-full text-left text-[13px] px-4 py-2.5 rounded-lg transition-all duration-150 ${
                  selectedAnswer !== null && index === card.quiz!.answer
                    ? 'bg-green-50 text-green-700 border border-green-200'
                    : selectedAnswer === index
                      ? 'bg-red-50 text-red-700 border border-red-200'
                      : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                }`}
              >
                {String.fromCharCode(65 + index)}. {opt}
              </button>
            ))}
          </div>
          {selectedAnswer !== null && (
            <p className="text-[12px] text-gray-500 mt-3 p-3 bg-gray-50 rounded-lg">
              {card.quiz.explanation}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => {
            setCardIndex(index => (index - 1 + LEARNING_CARDS.length) % LEARNING_CARDS.length);
            setSelectedAnswer(null);
          }}
          className="flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-black/[0.03] transition-all duration-150"
        >
          <ChevronLeft size={12} />
          上一课
        </button>
        <button
          onClick={() => {
            setCardIndex(index => (index + 1) % LEARNING_CARDS.length);
            setSelectedAnswer(null);
          }}
          className="flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-black/[0.03] transition-all duration-150"
        >
          下一课
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [funds, setFunds] = useState<ApiFund[]>([]);
  const [fundTotal, setFundTotal] = useState(0);
  const [indices, setIndices] = useState<ApiIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => new Date().toLocaleString('zh-CN'));

  useEffect(() => {
    Promise.all([
      fetch('/api/funds?page=1&size=30&sort=dailyChange&order=desc').then(r => r.json()).catch(() => ({ funds: [], total: 0 })),
      fetch('/api/index').then(r => r.json()).catch(() => ({ indices: [] })),
    ]).then(([fundsData, indexData]) => {
      setFunds(fundsData.funds || []);
      setFundTotal(fundsData.total || 0);
      setIndices(indexData.indices || []);
      setLoading(false);
    });
  }, []);

  const topFunds = [...funds]
    .filter(fund => fund.type !== '货币型')
    .sort((left, right) => right.dailyChange - left.dailyChange)
    .slice(0, 6);

  return (
    <div className="space-y-10 page-enter">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">欢迎回来</h1>
        <p className="text-[13px] text-gray-400 mt-1">{now}</p>
      </div>

      <section>
        <h2 className="text-[13px] font-medium text-gray-400 uppercase tracking-wider mb-4">市场概览</h2>
        {loading ? (
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7].map(item => (
              <div key={item} className="bg-gray-50 rounded-2xl p-5 h-24 animate-pulse border border-black/[0.04]" />
            ))}
          </div>
        ) : indices.length > 0 ? (
          <div className="grid grid-cols-4 gap-3">
            {indices.map(index => <MarketCard key={index.code} index={index} />)}
          </div>
        ) : (
          <p className="text-[13px] text-gray-400">无法获取市场数据，请确认后端服务已启动。</p>
        )}
      </section>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="基金总数" value={loading ? '--' : String(fundTotal)} sub="平台收录" />
        <StatCard label="今日上涨" value={loading ? '--' : String(funds.filter(fund => fund.dailyChange > 0).length)} sub="只基金" />
        <StatCard label="今日下跌" value={loading ? '--' : String(funds.filter(fund => fund.dailyChange < 0).length)} sub="只基金" />
        <StatCard label="学习进度" value="3 / 8" sub="课程完成" />
      </div>

      <div className="grid grid-cols-5 gap-6">
        <div className="col-span-3 bg-gray-50 rounded-2xl border border-black/[0.04] overflow-hidden">
          <div className="px-5 py-4 border-b border-black/[0.04] flex items-center justify-between">
            <h3 className="text-[15px] font-semibold tracking-tight">热门基金</h3>
            <Link href="/funds" className="text-[12px] text-blue-500 hover:text-blue-400 transition-colors">
              查看全部
            </Link>
          </div>
          {loading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3, 4, 5, 6].map(item => <div key={item} className="h-12 bg-white rounded-lg animate-pulse" />)}
            </div>
          ) : (
            <div className="divide-y divide-black/[0.04]">
              {topFunds.map((fund, index) => (
                <Link
                  key={fund.code}
                  href={`/fund/${fund.code}`}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-black/[0.02] transition-colors duration-150"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-5 text-center text-[12px] text-gray-300 font-medium">{index + 1}</span>
                    <div>
                      <p className="text-[13px] font-medium">{fund.name}</p>
                      <p className="text-[11px] text-gray-400">{fund.code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[13px] font-semibold tabular-nums ${fund.dailyChange >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {fund.dailyChange >= 0 ? '+' : ''}
                      {fund.dailyChange.toFixed(2)}%
                    </p>
                    <p className="text-[11px] text-gray-400 tabular-nums">{fund.nav.toFixed(4)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="col-span-2">
          <LearningTip />
        </div>
      </div>

      <section>
        <h2 className="text-[13px] font-medium text-gray-400 uppercase tracking-wider mb-4">快速入口</h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { href: '/academy', icon: BookOpen, title: 'K线学院', desc: 'K线与技术指标' },
            { href: '/funds', icon: Search, title: '基金筛选', desc: '多维度筛选' },
            { href: '/holdings', icon: Wallet, title: '持仓管理', desc: '记录收益与仓位' },
            { href: '/backtest', icon: TrendingUp, title: '投资模拟', desc: '功能待开发' },
          ].map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="bg-gray-50 rounded-2xl p-5 border border-black/[0.04] hover:border-black/[0.08] transition-all duration-200 group"
              >
                <Icon size={20} strokeWidth={1.5} className="text-gray-400 group-hover:text-blue-500 transition-colors duration-200 mb-3" />
                <p className="text-[13px] font-medium">{item.title}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
