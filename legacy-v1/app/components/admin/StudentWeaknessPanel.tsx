"use client";

import React, { useState } from 'react';
import { Search } from 'lucide-react';
import StudentWeaknessCard from './StudentWeaknessCard';
import StudentWeaknessModal from './StudentWeaknessModal';

type StudentWeaknessTopic = {
  topic: string;
  attempts: number;
  correct: number;
  wrong: number;
  accuracy: number;
};

type StudentWeakness = {
  key: string;
  name: string;
  attempts: number;
  avgScore: number;
  totalQuestionsAnswered: number;
  totalQuestionsWrong: number;
  weakestTopics: StudentWeaknessTopic[];
};

type Participant = {
  key: string;
  name: string;
  attempts: number;
  avgScore: number;
  totalQuestionsAnswered: number;
  totalQuestionsWrong: number;
};

type StudentWeaknessPanelProps = {
  students: StudentWeakness[];
  participants: Participant[];
  formatCategoryLabel: (value: string) => string;
  onCreateRemedialQuiz: (studentKeys: string[]) => void;
  theme?: 'light' | 'dark';
};

export default function StudentWeaknessPanel({
  students,
  participants,
  formatCategoryLabel,
  onCreateRemedialQuiz,
  theme = 'dark',
}: StudentWeaknessPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'totalWrong' | 'avgScore'>('totalWrong');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedStudent, setSelectedStudent] = useState<StudentWeakness | null>(null);

  // Merge participants with student weaknesses to show all students
  const allStudents: StudentWeakness[] = participants.map(participant => {
    const weakness = students.find(s => s.key === participant.key);
    if (weakness) {
      return weakness;
    }
    // Create a student entry using data from participants (all quiz session data)
    return {
      key: participant.key,
      name: participant.name,
      attempts: participant.attempts,
      avgScore: participant.avgScore,
      totalQuestionsAnswered: participant.totalQuestionsAnswered,
      totalQuestionsWrong: participant.totalQuestionsWrong,
      weakestTopics: [],
    };
  });

  // Filter and sort students
  const filteredStudents = allStudents
    .filter(student => {
      // Search filter
      if (searchQuery && !student.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Severity filter
      if (severityFilter !== 'all') {
        const wrongRate = 100 - student.avgScore;
        if (severityFilter === 'critical' && wrongRate <= 70) return false;
        if (severityFilter === 'high' && (wrongRate <= 50 || wrongRate > 70)) return false;
        if (severityFilter === 'medium' && (wrongRate <= 25 || wrongRate > 50)) return false;
        if (severityFilter === 'low' && wrongRate > 25) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'totalWrong') {
        const aTotalWrong = a.weakestTopics.reduce((sum, topic) => sum + topic.wrong, 0);
        const bTotalWrong = b.weakestTopics.reduce((sum, topic) => sum + topic.wrong, 0);
        return bTotalWrong - aTotalWrong;
      } else if (sortBy === 'avgScore') {
        return a.avgScore - b.avgScore;
      }
      return 0;
    });

  const handleToggleSelect = (key: string) => {
    const newSelected = new Set(selectedStudents);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedStudents(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedStudents.size === filteredStudents.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map(s => s.key)));
    }
  };

  return (
    <div data-theme={theme} className="space-y-3">
      <section className="glass space-y-4 rounded-3xl p-5" aria-labelledby="student-weakness-title">
        <div>
          <h2 id="student-weakness-title" className="text-[20px] font-bold tracking-tight text-fg">
            Student weakness
          </h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            Identify weak learners, then build focused remedial quiz sets.
          </p>
        </div>

        <div className="space-y-2.5 border-t border-line pt-4">
          <div className="relative">
            <input
              type="text"
              aria-label="Search students"
              placeholder="Search by student name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="well h-11 w-full rounded-xl pl-10 pr-4 text-[14px] font-medium text-fg placeholder:text-fg-subtle transition-calm"
            />
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle" aria-hidden="true" />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="well flex flex-wrap gap-1 rounded-xl p-1" role="group" aria-label="Severity">
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map((severity) => (
                <button
                  key={severity}
                  type="button"
                  aria-pressed={severityFilter === severity}
                  onClick={() => setSeverityFilter(severity)}
                  className={`h-11 md:h-9 rounded-lg px-3 text-[13px] font-semibold capitalize transition-calm ${
                    severityFilter === severity ? 'clay' : 'text-fg-muted hover:text-fg'
                  }`}
                >
                  {severity}
                </button>
              ))}
            </div>

            <div className="relative">
              <select
                value={sortBy}
                aria-label="Sort students"
                onChange={(e) => setSortBy(e.target.value as 'name' | 'totalWrong' | 'avgScore')}
                className="well well-hover h-11 min-w-[176px] cursor-pointer appearance-none rounded-xl pl-3.5 pr-10 text-[13px] font-medium text-fg transition-calm"
              >
                <option value="totalWrong">Sort by total wrong</option>
                <option value="avgScore">Sort by avg score</option>
                <option value="name">Sort by name</option>
              </select>
              <svg className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>

            <button
              type="button"
              onClick={handleSelectAll}
              className="well well-hover h-11 rounded-xl px-4 text-[13px] font-medium text-fg transition-calm"
            >
              {selectedStudents.size === filteredStudents.length ? 'Deselect all' : 'Select all'}
            </button>

            <span className="text-[13px] font-medium tabular-nums text-fg-muted">
              {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
            </span>

            {selectedStudents.size > 0 && (
              <button
                type="button"
                onClick={() => onCreateRemedialQuiz(Array.from(selectedStudents))}
                className="clay-primary ml-auto h-11 rounded-xl px-5 text-[14px] font-semibold"
              >
                Create quiz ({selectedStudents.size})
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="space-y-2.5 overflow-x-hidden">
        {filteredStudents.map((student) => (
          <StudentWeaknessCard
            key={student.key}
            student={student}
            selected={selectedStudents.has(student.key)}
            onToggleSelect={handleToggleSelect}
            onClick={setSelectedStudent}
            formatCategoryLabel={formatCategoryLabel}
            theme={theme}
          />
        ))}

        {filteredStudents.length === 0 && (
          <div className="glass rounded-3xl p-8 text-center">
            <p className="text-[15px] font-semibold text-fg">No students match current filters.</p>
            <p className="mt-1 text-[13px] text-fg-muted">Clear the search or pick another severity.</p>
          </div>
        )}
      </div>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <StudentWeaknessModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          formatCategoryLabel={formatCategoryLabel}
          theme={theme}
        />
      )}
    </div>
  );
}
