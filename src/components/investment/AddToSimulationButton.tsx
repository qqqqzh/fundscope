'use client';

import { FormEvent, MouseEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FolderPlus, Plus, X } from 'lucide-react';
import { type SimulationFundInput, useInvestmentSimulation } from '@/lib/useInvestmentSimulation';

interface AddToSimulationButtonProps {
  fund: SimulationFundInput;
  compact?: boolean;
}

export default function AddToSimulationButton({ fund, compact = false }: AddToSimulationButtonProps) {
  const router = useRouter();
  const { store, createGroup, addFundToGroup, groupsForFund } = useInvestmentSimulation();
  const [open, setOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [saved, setSaved] = useState(false);

  const existingGroups = groupsForFund(fund.code);
  const existingIds = useMemo(() => new Set(existingGroups.map(group => group.id)), [existingGroups]);
  const availableGroups = store.groups;

  function handleOpen(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setOpen(true);
    setSaved(false);
    setSelectedGroupId(store.groups[0]?.id ?? '');
  }

  function closePanel() {
    setOpen(false);
    setSaved(false);
    setNewGroupName('');
  }

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    const created = createGroup(newGroupName);
    if (created) {
      setSelectedGroupId(created.id);
      setNewGroupName('');
    }
  }

  function handleSave(continueConfig = false) {
    if (!selectedGroupId) return;
    addFundToGroup(selectedGroupId, fund);
    setSaved(true);
    if (continueConfig) {
      closePanel();
      router.push(`/backtest?group=${selectedGroupId}&fund=${fund.code}`);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={compact
          ? 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600'
          : 'inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-[11px] font-medium text-indigo-600 transition-colors hover:bg-indigo-100'}
        title="加入投资模拟"
      >
        <FolderPlus size={compact ? 15 : 13} />
        {!compact && <span>加入模拟</span>}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 px-4"
          onClick={closePanel}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
            onClick={event => { event.stopPropagation(); }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">投资模拟</p>
                <h3 className="mt-1 text-[17px] font-semibold text-gray-900">加入模拟分组</h3>
                <p className="mt-1 text-[12px] leading-5 text-gray-500">
                  {fund.name || fund.code} · {fund.code}
                </p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-gray-50 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>

            {existingGroups.length > 0 && (
              <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-[12px] leading-5 text-amber-700">
                已在这些分组中：{existingGroups.map(group => group.name).join('、')}
              </div>
            )}

            <div className="mt-4 space-y-2">
              <p className="text-[12px] font-medium text-gray-600">选择分组</p>
              {availableGroups.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-[12px] text-gray-400">
                  还没有模拟分组，先新建一个。
                </div>
              ) : (
                <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                  {availableGroups.map(group => (
                    <label
                      key={group.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 text-[13px] transition-colors ${
                        selectedGroupId === group.id
                          ? 'border-blue-200 bg-blue-50 text-blue-700'
                          : 'border-black/[0.05] bg-white text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>{group.name}</span>
                      <span className="flex items-center gap-2">
                        {existingIds.has(group.id) && <span className="text-[10px] text-amber-600">已加入</span>}
                        <input
                          type="radio"
                          checked={selectedGroupId === group.id}
                          onChange={() => setSelectedGroupId(group.id)}
                          className="accent-blue-500"
                        />
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <form onSubmit={handleCreate} className="mt-4 flex gap-2">
              <input
                value={newGroupName}
                onChange={event => setNewGroupName(event.target.value)}
                placeholder="新建分组名称"
                className="min-w-0 flex-1 rounded-xl border border-black/[0.06] px-3 py-2 text-[13px] outline-none transition-colors focus:border-blue-300"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 rounded-xl bg-gray-900 px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-gray-700"
              >
                <Plus size={13} />
                新建
              </button>
            </form>

            {saved && (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700">
                已加入模拟分组。
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={!selectedGroupId}
                className="rounded-xl border border-black/[0.06] px-4 py-2 text-[12px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                完成
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={!selectedGroupId}
                className="rounded-xl bg-blue-500 px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                继续配置
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

