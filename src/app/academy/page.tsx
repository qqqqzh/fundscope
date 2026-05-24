'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import type { KLineData } from '@/types/learn';
import { COURSE, getLessonById, getNextLessonId, getPrevLessonId } from '@/data/academy-courses';
import { useProgress } from '@/lib/useProgress';
import LessonSidebar from '@/components/academy/LessonSidebar';
import LessonChart from '@/components/academy/LessonChart';
import LessonContent from '@/components/academy/LessonContent';
import QuizPanel from '@/components/academy/QuizPanel';

export default function AcademyPage() {
  const { progress, completeLesson, setCurrentLesson, isLessonUnlocked, isLessonCompleted, getFirstUnlockedLesson } = useProgress();
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [remoteChart, setRemoteChart] = useState<{
    lessonId: string;
    data: KLineData[];
    error?: boolean;
  } | null>(null);

  const progressLessonId = progress.currentLesson && isLessonUnlocked(progress.currentLesson)
    ? progress.currentLesson
    : getFirstUnlockedLesson();
  const currentLessonId = selectedLessonId ?? progressLessonId;
  const lesson = currentLessonId ? getLessonById(currentLessonId) : null;

  useEffect(() => {
    if (!lesson) return;

    if (lesson.curatedData && lesson.curatedData.length > 0) {
      return;
    }

    let cancelled = false;
    const days = lesson.chartConfig.dataPoints;

    fetch(`/api/academy/kline?symbol=sh000300&days=${days}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        setRemoteChart({ lessonId: lesson.id, data: data.kline || [] });
      })
      .catch(() => {
        if (cancelled) return;
        setRemoteChart({ lessonId: lesson.id, data: [], error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [lesson]);

  const chartData = useMemo(() => {
    if (!lesson) return [];
    if (lesson.curatedData && lesson.curatedData.length > 0) return lesson.curatedData;
    return remoteChart?.lessonId === lesson.id ? remoteChart.data : [];
  }, [lesson, remoteChart]);

  const handleSelectLesson = useCallback((id: string) => {
    setSelectedLessonId(id);
    setCurrentLesson(id);
  }, [setCurrentLesson]);

  const handlePrev = useCallback(() => {
    if (!currentLessonId) return;
    const prev = getPrevLessonId(currentLessonId);
    if (prev) handleSelectLesson(prev);
  }, [currentLessonId, handleSelectLesson]);

  const handleNext = useCallback(() => {
    if (!currentLessonId) return;
    const next = getNextLessonId(currentLessonId);
    if (next && isLessonUnlocked(next)) handleSelectLesson(next);
  }, [currentLessonId, handleSelectLesson, isLessonUnlocked]);

  const handleQuizComplete = useCallback((scores: number[]) => {
    if (!currentLessonId) return;
    completeLesson(currentLessonId, scores);
  }, [currentLessonId, completeLesson]);

  if (!lesson) return null;

  const currentModule = COURSE.modules[lesson.moduleIndex];
  const completedCount = progress.completedLessons.length;
  const totalLessons = COURSE.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const canGoNext = !!getNextLessonId(currentLessonId) && isLessonCompleted(currentLessonId);
  const canGoPrev = !!getPrevLessonId(currentLessonId);
  const chartLoading = !lesson.curatedData?.length && remoteChart?.lessonId !== lesson.id;

  return (
    <div className="min-h-screen md:min-h-0 md:h-[calc(100vh-2rem)] lg:h-[calc(100vh-3rem)] flex flex-col overflow-visible md:overflow-hidden page-enter">
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen size={18} className="text-blue-500" />
          <h1 className="text-[18px] font-semibold tracking-tight">K线学院</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${(completedCount / totalLessons) * 100}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-400 tabular-nums">{completedCount}/{totalLessons}</span>
        </div>
      </div>

      {/* Module tabs */}
      <div className="flex gap-1 mb-2 flex-shrink-0 overflow-x-auto pb-1">
        {COURSE.modules.map((mod, i) => {
          const modComplete = mod.lessons.every(l => isLessonCompleted(l.id));
          const firstUnlockedLesson = mod.lessons.find(l => isLessonUnlocked(l.id));
          return (
            <button
              key={mod.id}
              onClick={() => {
                if (firstUnlockedLesson) handleSelectLesson(firstUnlockedLesson.id);
              }}
              disabled={!firstUnlockedLesson}
              className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150 ${
                lesson.moduleIndex === i
                  ? 'bg-blue-500 text-white'
                  : firstUnlockedLesson
                  ? 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed'
              }`}
            >
              {mod.title}
              {modComplete && <span className="ml-1.5">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div className="flex-1 grid grid-cols-[13rem_minmax(0,1fr)] gap-3 min-h-0 overflow-hidden max-lg:grid-cols-1 max-md:overflow-visible">
        {/* Sidebar */}
        <LessonSidebar
          module={currentModule}
          currentLessonId={currentLessonId}
          completedLessons={progress.completedLessons}
          isLessonUnlocked={isLessonUnlocked}
          onSelect={handleSelectLesson}
        />

        {/* Right panel */}
        <div className="flex-1 min-w-0 min-h-0 overflow-hidden grid grid-rows-[auto_minmax(0,5.2fr)_minmax(0,2fr)_minmax(0,1.55fr)] gap-2 max-md:flex max-md:flex-col max-md:overflow-visible">
          {/* Lesson title */}
          <div className="flex-shrink-0">
            <h2 className="text-[16px] font-semibold tracking-tight">{lesson.title}</h2>
            <p className="text-[11px] text-gray-400">{lesson.subtitle}</p>
          </div>

          {/* Chart */}
          <div className="min-h-[320px] md:min-h-0 bg-gray-50 rounded-xl border border-black/[0.04] overflow-hidden">
            {chartLoading ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-[12px] text-gray-400">加载K线数据...</p>
              </div>
            ) : chartData.length > 0 ? (
              <LessonChart data={chartData} config={lesson.chartConfig} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-[12px] text-gray-400">暂无数据</p>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="min-h-[150px] md:min-h-0 bg-gray-50 rounded-xl border border-black/[0.04] p-3 overflow-hidden">
            <LessonContent content={lesson.content} />
          </div>

          {/* Quiz + Navigation */}
          <div className="min-h-[150px] md:min-h-0 min-w-0 bg-gray-50 rounded-xl border border-black/[0.04] p-3 overflow-hidden flex gap-3 max-xl:flex-col">
            <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
              <QuizPanel
                key={lesson.id}
                questions={lesson.quiz}
                onComplete={handleQuizComplete}
              />
            </div>

            <div className="flex items-center justify-end gap-2 flex-shrink-0 self-end max-xl:self-auto">
              <button
                onClick={handlePrev}
                disabled={!canGoPrev}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-[12px] text-gray-500 hover:text-gray-900 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={14} /> 上一课
              </button>
              <button
                onClick={handleNext}
                disabled={!canGoNext}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-[12px] bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                下一课 <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
