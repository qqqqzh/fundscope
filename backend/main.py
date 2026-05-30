"""FundScope API - 基金数据后端"""
import os
# Bypass system proxy for data source requests
for k in ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY']:
    os.environ.pop(k, None)
os.environ['no_proxy'] = '*'

# Monkey-patch requests to bypass Windows system proxy
import requests
_original_session = requests.Session
class _NoProxySession(requests.Session):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.trust_env = False
requests.Session = _NoProxySession

import akshare as ak
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import asyncio
import json
import traceback

app = FastAPI(title="FundScope API")

# Simple in-memory cache
_cache = {}
_CACHE_TTL = 300  # 5 minutes

def get_cached(key, fetcher):
    now = datetime.now().timestamp()
    if key in _cache:
        data, ts = _cache[key]
        if now - ts < _CACHE_TTL:
            return data
    data = fetcher()
    _cache[key] = (data, now)
    return data

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.environ.get("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


def safe_float(val, default=0.0):
    try:
        if pd.isna(val):
            return default
        return float(val)
    except (ValueError, TypeError):
        return default


SECTOR_KEYWORDS = {
    # ── 科技（细分优先，宽泛兜底）──
    "CPO": ["cpo", "共封装"],
    "存储芯片": ["存储芯片", "dram", "nand"],
    "光刻机": ["光刻机", "光刻胶"],
    "光模块": ["光模块"],
    "无人驾驶": ["无人驾驶", "自动驾驶", "adas"],
    "脑机接口": ["脑机接口"],
    "卫星互联网": ["卫星互联网", "星链"],
    "量子": ["量子"],
    "信创": ["信创"],
    "鸿蒙": ["鸿蒙"],
    "华为概念": ["华为概念", "华为产业链"],
    "东数西算": ["东数西算"],
    "AI": ["人工智能", "ai", "智能", "大模型", "aigc", "chatgpt", "算力"],
    "机器人": ["机器人", "人形机器人"],
    "半导体": ["半导体"],
    "芯片": ["芯片"],
    "消费电子": ["消费电子", "苹果概念", "折叠屏"],
    "数字经济": ["数字经济", "数据要素"],
    "网络安全": ["网络安全", "信息安全"],
    "科技": ["科技", "信息技术", "tmt"],
    "云计算": ["云计算", "云服务"],
    "物联网": ["物联网", "iot"],
    "区块链": ["区块链"],

    # ── 新能源 & 电力（细分优先，宽泛兜底）──
    "固态电池": ["固态电池"],
    "储能": ["储能", "抽水蓄能"],
    "氢能": ["氢能", "氢能源", "燃料电池"],
    "核电": ["核电", "核能"],
    "特高压": ["特高压"],
    "智能电网": ["智能电网"],
    "碳中和": ["碳中和", "碳交易", "碳", "esg"],
    "光伏": ["光伏", "太阳能"],
    "风电": ["风电", "风力发电"],
    "新能源车": ["新能源车", "电动车"],
    "锂电池": ["锂电池", "锂电", "碳酸锂"],
    "充电桩": ["充电桩"],
    "新能源": ["新能源"],
    "电力": ["电力"],

    # ── 军工 & 航天（细分优先）──
    "商业航天": ["商业航天"],
    "低空经济": ["低空经济", "飞行汽车", "evtol"],
    "无人机": ["无人机"],
    "卫星": ["卫星", "北斗"],
    "军工": ["军工", "国防"],
    "航天": ["航天"],

    # ── 医药（细分优先）──
    "创新药": ["创新药"],
    "CXO": ["cxo", "cro", "cdmo", "医药外包"],
    "中药": ["中药"],
    "减肥药": ["减肥药", "glp-1"],
    "疫苗": ["疫苗"],
    "基因": ["基因", "基因测序"],
    "医美": ["医美"],
    "生物医药": ["生物医药", "生物"],
    "医疗": ["医疗", "医疗器械"],
    "医药": ["医药"],
    "养老": ["养老", "老龄"],

    # ── 消费 ──
    "白酒": ["白酒"],
    "免税": ["免税"],
    "食品饮料": ["食品", "饮料"],
    "家电": ["家电"],
    "游戏": ["游戏"],
    "影视": ["影视", "动漫"],
    "传媒": ["传媒"],
    "消费": ["消费"],
    "旅游": ["旅游", "酒店"],
    "汽车": ["汽车"],
    "教育": ["教育"],
    "体育": ["体育"],

    # ── 金融 ──
    "银行": ["银行"],
    "证券": ["证券", "券商"],
    "保险": ["保险"],
    "地产": ["地产", "房地产"],

    # ── 周期 & 资源 ──
    "黄金": ["黄金", "gold"],
    "白银": ["白银", "silver"],
    "有色金属": ["有色金属", "有色"],
    "稀土": ["稀土"],
    "煤炭": ["煤炭"],
    "石油": ["石油", "油气", "原油"],
    "钢铁": ["钢铁"],
    "化工": ["化工"],
    "建材": ["建材", "水泥"],
    "基建": ["基建"],
    "铜": ["铜"],
    "铝": ["铝"],
    "锂": ["锂"],

    # ── 农业 ──
    "养殖": ["养殖", "猪"],
    "种业": ["种业"],
    "农业": ["农业"],

    # ── 宽基指数 ──
    "恒生科技": ["恒生科技"],
    "港股": ["恒生", "港股", "香港", "沪港深"],
    "纳斯达克": ["纳斯达克", "nasdaq"],
    "标普500": ["标普", "sp500", "s&p"],
    "中概股": ["中概", "中国互联"],
    "沪深300": ["沪深300"],
    "中证500": ["中证500"],
    "中证1000": ["中证1000"],
    "创业板": ["创业板"],
    "科创板": ["科创"],
    "红利": ["红利", "高股息"],
    "MSCI": ["msci"],

    # ── 其他 ──
    "债券": ["债券", "信用债", "利率债", "可转债", "债"],
    "货币": ["货币"],
    "物流": ["物流", "快递"],
}

_INDUSTRY_SECTOR_MAP = {
    "电子": "电子",
    "计算机": "计算机",
    "通信": "通信",
    "传媒": "传媒",
    "医药生物": "医药",
    "食品饮料": "消费",
    "家用电器": "家电",
    "汽车": "汽车",
    "银行": "银行",
    "非银金融": "金融",
    "房地产": "地产",
    "建筑材料": "建材",
    "建筑装饰": "基建",
    "机械设备": "机械",
    "国防军工": "军工",
    "电力设备": "电力",
    "有色金属": "有色金属",
    "煤炭": "煤炭",
    "钢铁": "钢铁",
    "化工": "化工",
    "农林牧渔": "农业",
    "纺织服饰": "纺织",
    "商贸零售": "零售",
    "社会服务": "服务",
    "交通运输": "交运",
    "公用事业": "公用",
    "石油石化": "石油",
    "环保": "环保",
    "美容护理": "美容",
}


def infer_sectors(name: str, holdings: list = None) -> list[str]:
    """从基金名称和持仓推断板块/主题"""
    name_lower = name.lower()
    sectors = []
    # 名称关键词匹配
    for sector, keywords in SECTOR_KEYWORDS.items():
        for kw in keywords:
            if kw in name_lower:
                sectors.append(sector)
                break
    # 持仓行业补充
    if holdings:
        industry_weights = {}
        for h in holdings:
            ind = h.get("industry", "") if isinstance(h, dict) else ""
            if ind:
                mapped = _INDUSTRY_SECTOR_MAP.get(ind, ind)
                industry_weights[mapped] = industry_weights.get(mapped, 0) + (h.get("weight", 0) if isinstance(h, dict) else 0)
        # 权重 > 8% 的行业作为板块标签
        for ind, weight in sorted(industry_weights.items(), key=lambda x: -x[1]):
            if weight > 8 and ind not in sectors:
                sectors.append(ind)
    return sectors


def infer_fund_type(name: str) -> str:
    """从基金名称推断类型"""
    name = name.lower()
    if '货币' in name:
        return '货币型'
    if 'etf联接' in name or 'etf 联接' in name:
        return 'ETF联接'
    if 'etf' in name:
        return 'ETF'
    if 'qdii' in name or '全球' in name or '纳斯达克' in name or '标普' in name:
        return 'QDII'
    if '指数' in name or '沪深300' in name or '中证' in name or '创业板' in name or '科创' in name:
        return '指数型'
    if '债' in name or '信用' in name or '利率' in name or '可转债' in name:
        return '债券型'
    if '混合' in name:
        return '混合型'
    if '股票' in name:
        return '股票型'
    return '混合型'


def _fetch_all_funds():
    """Fetch and process all funds from akshare (cached)"""
    df = ak.fund_open_fund_rank_em(symbol="全部")
    all_funds = []
    for _, row in df.iterrows():
        year_val = safe_float(row.get("近1年"))
        # Skip funds without 1-year data
        if year_val == 0 and pd.isna(row.get("近1年")):
            continue
        name = str(row.get("基金简称", ""))
        all_funds.append({
            "code": str(row.get("基金代码", "")),
            "name": name,
            "type": infer_fund_type(name),
            "sectors": infer_sectors(name),
            "nav": safe_float(row.get("单位净值")),
            "accNav": safe_float(row.get("累计净值")),
            "dailyChange": safe_float(row.get("日增长率")),
            "weekChange": safe_float(row.get("近1周")),
            "monthChange": safe_float(row.get("近1月")),
            "month3Change": safe_float(row.get("近3月")),
            "month6Change": safe_float(row.get("近6月")),
            "yearChange": year_val,
            "date": str(row.get("日期", "")),
        })
    return all_funds


@app.get("/api/funds")
def list_funds(page: int = 1, size: int = 20, sort: str = "yearChange", order: str = "desc", per_type: int = 0):
    """获取基金列表（按近1年收益排序，分页）"""
    try:
        all_funds = get_cached("all_funds", _fetch_all_funds)

        if per_type > 0:
            # Each type gets its own top-N slice, ensuring all types are represented
            from collections import defaultdict
            by_type = defaultdict(list)
            for f in all_funds:
                by_type[f["type"]].append(f)
            funds = []
            for t, tlist in by_type.items():
                reverse = order == "desc"
                tlist.sort(key=lambda f: f.get(sort, 0) or 0, reverse=reverse)
                funds.extend(tlist[:per_type])
            # Sort combined result
            reverse = order == "desc"
            funds.sort(key=lambda f: f.get(sort, 0) or 0, reverse=reverse)
        else:
            funds = all_funds
            reverse = order == "desc"
            if sort in funds[0] if funds else False:
                funds.sort(key=lambda f: f.get(sort, 0) or 0, reverse=reverse)

        total = len(funds)
        # Paginate
        start = (page - 1) * size
        end = start + size
        page_funds = funds[start:end]

        return {"funds": page_funds, "total": total, "page": page, "size": size, "pages": (total + size - 1) // size}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/fund/{code}/nav")
def fund_nav(code: str, days: int = 365):
    """获取基金历史净值"""
    try:
        df = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail="基金未找到")

        df = df.tail(days)
        history = []
        for _, row in df.iterrows():
            history.append({
                "date": str(row.get("净值日期", "")),
                "nav": safe_float(row.get("单位净值")),
                "accNav": safe_float(row.get("累计净值")),
            })
        return {"code": code, "history": history}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/fund/{code}/detail")
def fund_detail(code: str):
    """获取基金详情"""
    try:
        # 基本信息
        df_info = ak.fund_individual_basic_info_xq(symbol=code)
        info = {}
        if df_info is not None and not df_info.empty:
            for _, row in df_info.iterrows():
                info[str(row.iloc[0])] = str(row.iloc[1]) if len(row) > 1 else ""

        # 净值走势
        df_nav = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
        nav_history = []
        if df_nav is not None and not df_nav.empty:
            for _, row in df_nav.tail(500).iterrows():
                nav_history.append({
                    "date": str(row.get("净值日期", "")),
                    "nav": safe_float(row.get("单位净值")),
                    "accNav": safe_float(row.get("累计净值")),
                })

        return {
            "code": code,
            "info": info,
            "navHistory": nav_history,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/fund/{code}/holding")
def fund_holding(code: str):
    """获取基金持仓"""
    try:
        # 股票持仓
        df_stock = ak.fund_portfolio_hold_em(symbol=code, date="2024")
        top_stocks = []
        if df_stock is not None and not df_stock.empty:
            latest = df_stock.head(10)
            for _, row in latest.iterrows():
                top_stocks.append({
                    "name": str(row.get("股票名称", "")),
                    "weight": safe_float(row.get("占净值比例")),
                    "industry": str(row.get("所属行业", "")),
                })

        return {"code": code, "topStocks": top_stocks}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


def _calc_risk_metrics(nav_values: list[float]) -> dict:
    """从净值序列计算风险指标"""
    import math
    if len(nav_values) < 30:
        return {"maxDrawdown": 0, "volatility": 0, "sharpe": 0, "calmar": 0}

    # Daily returns
    returns = []
    for i in range(1, len(nav_values)):
        if nav_values[i-1] > 0:
            returns.append(nav_values[i] / nav_values[i-1] - 1)

    if not returns:
        return {"maxDrawdown": 0, "volatility": 0, "sharpe": 0, "calmar": 0}

    # Annualized volatility
    avg_ret = sum(returns) / len(returns)
    var = sum((r - avg_ret) ** 2 for r in returns) / (len(returns) - 1) if len(returns) > 1 else 0
    daily_vol = math.sqrt(var)
    annual_vol = daily_vol * math.sqrt(252) * 100

    # Max drawdown
    peak = nav_values[0]
    max_dd = 0
    for v in nav_values:
        if v > peak:
            peak = v
        dd = (peak - v) / peak
        if dd > max_dd:
            max_dd = dd
    max_dd_pct = max_dd * 100

    # Sharpe (assuming 2% risk-free rate)
    annual_ret = avg_ret * 252 * 100
    sharpe = (annual_ret - 2) / annual_vol if annual_vol > 0 else 0

    # Calmar ratio
    calmar = annual_ret / max_dd_pct if max_dd_pct > 0 else 0

    return {
        "maxDrawdown": round(max_dd_pct, 2),
        "volatility": round(annual_vol, 2),
        "sharpe": round(sharpe, 2),
        "calmar": round(calmar, 2),
        "annualReturn": round(annual_ret, 2),
    }


def _fetch_nav(code: str):
    """获取净值历史（365天）"""
    df_nav = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
    if df_nav is None or df_nav.empty:
        return [], []
    df_nav = df_nav.tail(365)
    nav_history = []
    nav_values = []
    for _, row in df_nav.iterrows():
        v = safe_float(row.get("单位净值"))
        nav_history.append({"date": str(row.get("净值日期", "")), "nav": v})
        nav_values.append(v)
    return nav_history, nav_values


def _fetch_holdings(code: str):
    """获取重仓持股"""
    df_stock = ak.fund_portfolio_hold_em(symbol=code, date="2024")
    if df_stock is None or df_stock.empty:
        return []
    top_stocks = []
    for _, row in df_stock.head(10).iterrows():
        top_stocks.append({
            "name": str(row.get("股票名称", "")),
            "weight": safe_float(row.get("占净值比例")),
            "industry": str(row.get("所属行业", "")),
        })
    return top_stocks


def _get_basic_info(code: str):
    """从缓存获取基金基本信息"""
    name = f"基金{code}"
    fund_type = "未知"
    nav_val = 0
    daily_chg = 0
    acc_nav = 0
    try:
        all_funds = get_cached("all_funds", _fetch_all_funds)
        for f in all_funds:
            if f["code"] == code:
                name = f["name"]
                fund_type = f["type"]
                nav_val = f["nav"]
                daily_chg = f["dailyChange"]
                acc_nav = f["accNav"]
                break
    except Exception:
        pass
    return name, fund_type, nav_val, daily_chg, acc_nav


@app.get("/api/fund/{code}/analyze")
async def fund_analyze(code: str):
    """获取基金分析数据（净值+风险指标），先返回图表数据"""
    cache_key = f"analyze_{code}"
    now = datetime.now().timestamp()
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return data

    # 1. 基本信息（内存缓存，瞬间）
    name, fund_type, nav_val, daily_chg, acc_nav = _get_basic_info(code)

    # 2. 如果缓存没命中，补查名称（慢，只在必要时）
    if name.startswith("基金"):
        try:
            df_info = await asyncio.to_thread(ak.fund_individual_basic_info_xq, symbol=code)
            if df_info is not None and not df_info.empty:
                name_row = df_info[df_info["item"] == "基金名称"]
                if not name_row.empty:
                    name = str(name_row.iloc[0]["value"])
        except Exception:
            pass

    if fund_type == "未知":
        fund_type = infer_fund_type(name)

    # 3. 只请求净值（图表必需），持仓单独接口
    nav_history, nav_values = await asyncio.to_thread(_fetch_nav, code)

    if nav_val == 0 and nav_values:
        nav_val = nav_values[-1]
        if len(nav_values) >= 2:
            daily_chg = (nav_values[-1] / nav_values[-2] - 1) * 100

    risk = _calc_risk_metrics(nav_values)

    # 持仓数据（用于板块推断）— 从缓存取
    holding_data = []
    try:
        holding_key = f"holding_{code}"
        if holding_key in _cache:
            holding_data, _ = _cache[holding_key]
            if isinstance(holding_data, dict):
                holding_data = holding_data.get("holding", [])
    except Exception:
        pass

    # 计算区间收益
    def period_change(days: int) -> float:
        if len(nav_history) < 2:
            return 0
        latest = nav_history[-1]["nav"]
        base_idx = max(0, len(nav_history) - 1 - days)
        base = nav_history[base_idx]["nav"]
        if not base:
            return 0
        return round((latest / base - 1) * 100, 2)

    result = {
        "code": code,
        "name": name,
        "type": fund_type,
        "sectors": infer_sectors(name, holding_data),
        "nav": nav_val,
        "dailyChange": round(daily_chg, 2),
        "accNav": acc_nav,
        "navDate": str(nav_history[-1]["date"]) if nav_history else "",
        "weekChange": period_change(5),
        "monthChange": period_change(21),
        "yearChange": period_change(252),
        "navHistory": nav_history,
        "holding": [],  # 先返回空，前端单独请求
        "risk": risk,
    }
    _cache[cache_key] = (result, now)
    return result


@app.get("/api/fund/{code}/holding")
async def fund_holding_async(code: str):
    """获取持仓数据（单独接口，延迟加载）"""
    cache_key = f"holding_{code}"
    now = datetime.now().timestamp()
    if cache_key in _cache:
        data, ts = _cache[cache_key]
        if now - ts < _CACHE_TTL:
            return data

    top_stocks = await asyncio.to_thread(_fetch_holdings, code)
    result = {"code": code, "holding": top_stocks}
    _cache[cache_key] = (result, now)
    return result


@app.get("/api/index")
def market_index():
    """获取主要指数（A股 + 港股 + 美股）"""
    result = []

    # A股指数（Sina）
    try:
        df = ak.stock_zh_index_spot_sina()
        cn_indices = {
            "上证指数": "sh000001",
            "深证成指": "sz399001",
            "创业板指": "sz399006",
            "沪深300": "sh000300",
        }
        for name, code in cn_indices.items():
            row = df[df["代码"] == code]
            if not row.empty:
                r = row.iloc[0]
                result.append({
                    "name": name,
                    "code": code,
                    "value": safe_float(r.get("最新价")),
                    "change": safe_float(r.get("涨跌幅")),
                    "market": "cn",
                })
    except Exception:
        traceback.print_exc()

    # 港股指数（Sina）
    try:
        df_hk = ak.stock_hk_index_spot_sina()
        hk_codes = {"恒生指数": "HSI"}
        for name, code in hk_codes.items():
            row = df_hk[df_hk["代码"] == code]
            if not row.empty:
                r = row.iloc[0]
                result.append({
                    "name": name,
                    "code": code,
                    "value": safe_float(r.get("最新价")),
                    "change": safe_float(r.get("涨跌幅")),
                    "market": "hk",
                })
    except Exception:
        traceback.print_exc()

    # 美股指数（Sina 历史数据取最新）
    us_symbols = {
        "纳斯达克": ".IXIC",
        "道琼斯": ".DJI",
        "标普500": ".INX",
    }
    for name, symbol in us_symbols.items():
        try:
            df_us = ak.index_us_stock_sina(symbol=symbol)
            if df_us is not None and len(df_us) >= 2:
                last = df_us.iloc[-1]
                prev = df_us.iloc[-2]
                value = safe_float(last.get("close"))
                prev_close = safe_float(prev.get("close"))
                change = ((value - prev_close) / prev_close * 100) if prev_close else 0
                result.append({
                    "name": name,
                    "code": symbol,
                    "value": round(value, 2),
                    "change": round(change, 2),
                    "market": "us",
                })
        except Exception:
            pass

    return {"indices": result}


def _fetch_etfs():
    """获取ETF列表（缓存用）"""
    df = ak.fund_etf_spot_em()
    result = []
    for _, row in df.iterrows():
        result.append({
            "code": str(row.get("代码", "")),
            "name": str(row.get("名称", "")),
            "price": safe_float(row.get("最新价")),
            "change": safe_float(row.get("涨跌幅")),
        })
    return result


def _search_funds_sync(q: str):
    """在缓存的基金列表中搜索"""
    funds = []
    try:
        all_funds = get_cached("all_funds", _fetch_all_funds)
        ql = q.lower()
        for f in all_funds:
            if ql in f["name"].lower() or ql in f["code"].lower():
                funds.append(f)
            if len(funds) >= 20:
                break
    except Exception:
        pass
    return funds


def _search_etfs_sync(q: str):
    """在缓存的ETF列表中搜索"""
    etfs = []
    try:
        all_etfs = get_cached("etfs", _fetch_etfs)
        ql = q.lower()
        for e in all_etfs:
            if ql in e["name"].lower() or ql in e["code"].lower():
                etfs.append(e)
            if len(etfs) >= 15:
                break
    except Exception:
        pass
    return etfs


def _fallback_fund_lookup(code: str):
    """代码未命中缓存时，直接查数据源"""
    try:
        df_nav = ak.fund_open_fund_info_em(symbol=code, indicator="单位净值走势")
        if df_nav is None or df_nav.empty:
            return None
        last = df_nav.iloc[-1]
        fund_name = f"基金{code}"
        try:
            df_info = ak.fund_individual_basic_info_xq(symbol=code)
            if df_info is not None and not df_info.empty:
                name_row = df_info[df_info["item"] == "基金名称"]
                if not name_row.empty:
                    fund_name = str(name_row.iloc[0]["value"])
        except Exception:
            pass
        return {
            "code": code,
            "name": fund_name,
            "type": infer_fund_type(fund_name),
            "nav": safe_float(last.get("单位净值")),
            "accNav": 0,
            "dailyChange": safe_float(last.get("日增长率")),
            "weekChange": 0, "monthChange": 0,
            "month3Change": 0, "month6Change": 0,
            "yearChange": 0,
        }
    except Exception:
        return None


@app.get("/api/search")
async def search_funds(q: str):
    """搜索基金 + 指数（async并行）"""
    # 指数（内存，瞬间）
    all_indices = [
        {"name": "上证指数", "code": "sh000001", "market": "cn"},
        {"name": "深证成指", "code": "sz399001", "market": "cn"},
        {"name": "创业板指", "code": "sz399006", "market": "cn"},
        {"name": "沪深300", "code": "sh000300", "market": "cn"},
        {"name": "恒生指数", "code": "HSI", "market": "hk"},
        {"name": "纳斯达克", "code": ".IXIC", "market": "us"},
        {"name": "道琼斯", "code": ".DJI", "market": "us"},
        {"name": "标普500", "code": ".INX", "market": "us"},
    ]
    indices = [idx for idx in all_indices if q.lower() in idx["name"].lower() or q.lower() in idx["code"].lower()]

    # 基金 + ETF 并行搜索（都在缓存里，但避免首次冷启动阻塞）
    fund_task = asyncio.to_thread(_search_funds_sync, q)
    etf_task = asyncio.to_thread(_search_etfs_sync, q)
    funds, etfs = await asyncio.gather(fund_task, etf_task)

    # 兜底：代码未命中缓存时直接查
    if not funds and q.isdigit() and len(q) == 6:
        fallback = await asyncio.to_thread(_fallback_fund_lookup, q)
        if fallback:
            funds = [fallback]

    return {"funds": funds, "indices": indices, "etfs": etfs, "fundCount": len(funds), "indexCount": len(indices), "etfCount": len(etfs)}


@app.get("/api/academy/kline")
def academy_kline(symbol: str = "sh000300", days: int = 120):
    """获取指数OHLC K线数据（教学用）"""
    try:
        df = ak.stock_zh_index_daily(symbol=symbol)
        if df is None or df.empty:
            raise HTTPException(status_code=404, detail="数据未找到")

        df = df.tail(days)
        kline = []
        for _, row in df.iterrows():
            kline.append({
                "date": str(row.get("date", "")),
                "open": safe_float(row.get("open")),
                "close": safe_float(row.get("close")),
                "high": safe_float(row.get("high")),
                "low": safe_float(row.get("low")),
                "volume": safe_float(row.get("volume")),
            })
        return {"symbol": symbol, "kline": kline, "count": len(kline)}
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
