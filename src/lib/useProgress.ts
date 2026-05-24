'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { UserProgress } from '@/types/learn';
import { ALL_LESSONS } from '@/data/academy-courses';

const STORAGE_KEY = 'fundscope-academy-progress';
const CHANGE_EVENT = 'fundscope-academy-progress-change';
const EMPTY_PROGRESS: UserProgress = {
  completedLessons: [],
  quizScores: {},
  currentLesson: null,
  lastAccessed: '',
};
const EMPTY_SNAPSHOT = JSON.stringify(EMPTY_PROGRESS);

function loadFromStorage(): UserProgress {
  if (typeof window === 'undefined') return EMPTY_PROGRESS;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY_PROGRESS, ...JSON.parse(raw) };
  } catch {}

  return EMPTY_PROGRESS;
}

function getSnapshot() {
  return JSON.stringify(loadFromStorage());
}

function getServerSnapshot() {
  return EMPTY_SNAPSHOT;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

function saveToStorage(progress: UserProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {}
}

export function useProgress() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const progress = useMemo(() => JSON.parse(snapshot) as UserProgress, [snapshot]);

  const completeLesson = useCallback((lessonId: string, scores: number[]) => {
    const current = loadFromStorage();
    const next: UserProgress = {
      ...current,
      completedLessons: [...new Set([...current.completedLessons, lessonId])],
      quizScores: { ...current.quizScores, [lessonId]: scores },
      currentLesson: lessonId,
      lastAccessed: new Date().toISOString(),
    };
    saveToStorage(next);
  }, []);

  const setCurrentLesson = useCallback((lessonId: string) => {
    const current = loadFromStorage();
    const next: UserProgress = {
      ...current,
      currentLesson: lessonId,
      lastAccessed: new Date().toISOString(),
    };
    saveToStorage(next);
  }, []);

  const isLessonUnlocked = useCallback((lessonId: string): boolean => {
    const idx = ALL_LESSONS.findIndex(l => l.id === lessonId);
    if (idx <= 0) return true;
    return progress.completedLessons.includes(ALL_LESSONS[idx - 1].id);
  }, [progress.completedLessons]);

  const isLessonCompleted = useCallback((lessonId: string): boolean => {
    return progress.completedLessons.includes(lessonId);
  }, [progress.completedLessons]);

  const getFirstUnlockedLesson = useCallback((): string => {
    for (const lesson of ALL_LESSONS) {
      if (!progress.completedLessons.includes(lesson.id)) return lesson.id;
    }
    return ALL_LESSONS[ALL_LESSONS.length - 1].id;
  }, [progress.completedLessons]);

  return {
    progress,
    completeLesson,
    setCurrentLesson,
    isLessonUnlocked,
    isLessonCompleted,
    getFirstUnlockedLesson,
  };
}
