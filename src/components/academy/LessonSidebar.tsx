'use client';

import { Lock, Check, Circle } from 'lucide-react';
import type { CourseModule } from '@/types/learn';

interface Props {
  module: CourseModule;
  currentLessonId: string;
  completedLessons: string[];
  isLessonUnlocked: (id: string) => boolean;
  onSelect: (id: string) => void;
}

export default function LessonSidebar({ module, currentLessonId, completedLessons, isLessonUnlocked, onSelect }: Props) {
  return (
    <div className="w-52 flex-shrink-0 space-y-1 max-lg:w-full max-lg:flex max-lg:gap-2 max-lg:space-y-0 max-lg:overflow-x-auto max-lg:pb-2">
      <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-3 px-2 max-lg:hidden">{module.title}</p>
      {module.lessons.map(lesson => {
        const done = completedLessons.includes(lesson.id);
        const locked = !isLessonUnlocked(lesson.id);
        const active = lesson.id === currentLessonId;

        return (
          <button
            key={lesson.id}
            onClick={() => !locked && onSelect(lesson.id)}
            disabled={locked}
            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 flex items-center gap-2.5 max-lg:w-44 max-lg:flex-shrink-0 ${
              active
                ? 'bg-blue-50 text-blue-700'
                : locked
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span className="flex-shrink-0">
              {done ? (
                <Check size={14} className="text-green-500" />
              ) : locked ? (
                <Lock size={14} />
              ) : active ? (
                <Circle size={14} className="fill-blue-500 text-blue-500" />
              ) : (
                <Circle size={14} className="text-gray-300" />
              )}
            </span>
            <div className="min-w-0">
              <p className={`text-[12px] truncate ${active ? 'font-medium' : ''}`}>{lesson.title}</p>
              <p className="text-[10px] text-gray-400 truncate">{lesson.id}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
