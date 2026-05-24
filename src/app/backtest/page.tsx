import Link from 'next/link';
import { ArrowRight, Clock3, Search, Star, Wallet } from 'lucide-react';

const NEXT_STEPS = [
  {
    title: '基金筛选',
    description: '先挑出想跟踪的基金标的，建立自己的观察池。',
    href: '/funds',
    icon: Search,
  },
  {
    title: '自选管理',
    description: '把重点基金加入自选，后续统一看走势和分析。',
    href: '/watchlist',
    icon: Star,
  },
  {
    title: '持仓记录',
    description: '先把真实持仓录进去，后面模拟功能再和持仓联动。',
    href: '/holdings',
    icon: Wallet,
  },
];

export default function BacktestPage() {
  return (
    <div className="space-y-8 page-enter">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">投资模拟</h1>
        <p className="text-[13px] text-gray-400 mt-1">
          这个模块暂时不做内容，后续会在功能方案明确后再补上。
        </p>
      </div>

      <section className="rounded-[28px] border border-black/[0.06] bg-[linear-gradient(135deg,rgba(239,246,255,1),rgba(255,255,255,1)_52%,rgba(240,253,250,1))] p-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-[11px] font-medium text-blue-600">
            <Clock3 size={12} />
            待开发
          </div>
          <h2 className="mt-4 text-[26px] font-semibold tracking-tight text-gray-900">
            回测与模拟策略会放到后续版本
          </h2>
          <p className="mt-3 text-[14px] leading-7 text-gray-500">
            当前版本先聚焦基金筛选、自选跟踪和持仓记录，把核心信息链路做顺。等这几部分稳定后，再补投资模拟、定投回测和策略比较功能。
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {NEXT_STEPS.map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-2xl border border-black/[0.05] bg-white/85 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-black/[0.1] hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
              >
                <Icon size={18} strokeWidth={1.8} className="text-gray-500 group-hover:text-blue-600" />
                <h3 className="mt-4 text-[15px] font-semibold text-gray-900">{item.title}</h3>
                <p className="mt-2 text-[12px] leading-6 text-gray-500">{item.description}</p>
                <div className="mt-5 inline-flex items-center gap-1 text-[12px] font-medium text-blue-600">
                  前往查看
                  <ArrowRight size={14} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
