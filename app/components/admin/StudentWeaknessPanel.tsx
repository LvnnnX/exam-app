"use client";

import React, { useState } from 'react';
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
    <div className="space-y-4">
      <div
        className={`rounded-[24px] border p-5 shadow-ios-sm ${
          theme === 'dark'
            ? 'border-dark-border-subtle bg-dark-800'
            : 'border-[#E5E5E5] bg-white'
        }`}
      >
        <h2
          className={`text-[20px] font-semibold tracking-tight ${
            theme === 'dark' ? 'text-dark-text-primary' : 'text-gray-900'
          }`}
        >
          Student Weakness
        </h2>
        <p
          className={`mt-1 text-xs font-medium ${
            theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
          }`}
        >
          Identify weak learners, then build focused remedial quiz sets.
        </p>
      </div>

      <div
        className={`space-y-3 rounded-[24px] border p-5 shadow-ios-sm ${
          theme === 'dark'
            ? 'border-dark-border-subtle bg-dark-800'
            : 'border-[#E5E5E5] bg-white'
        }`}
      >
        <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${theme === 'dark' ? 'text-dark-text-muted' : 'text-[#8a8a8a]'}`}>
          Filter & actions
        </p>
        {/* Search */}
        <input
          type="text"
          placeholder="Search by student name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`h-11 w-full rounded-2xl border px-4 text-sm font-medium transition-spring-fast focus:outline-none focus:ring-2 ${
            theme === 'dark'
              ? 'border-dark-border-medium bg-dark-750 text-dark-text-primary placeholder:text-dark-text-tertiary focus:border-accent-blue focus:ring-accent-blue/10'
              : 'border-[#E5E5E5] bg-white text-gray-900 placeholder:text-gray-400 focus:border-gray-900 focus:ring-gray-900/10'
          }`}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`inline-flex h-10 rounded-full border p-0.5 ${
              theme === 'dark' ? 'border-dark-border-medium bg-dark-800' : 'border-[#e5e5e5] bg-white'
            }`}
          >
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map((severity) => (
              <button
                key={severity}
                type="button"
                onClick={() => setSeverityFilter(severity)}
                className={`rounded-full px-3.5 text-[11px] font-semibold transition-spring-fast ${
                  severityFilter === severity
                    ? theme === 'dark'
                      ? 'bg-accent-blue text-white'
                      : 'bg-gray-900 text-white'
                    : theme === 'dark'
                    ? 'text-dark-text-primary hover:bg-dark-700'
                    : 'text-gray-900 hover:bg-gray-100'
                }`}
              >
                {severity}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'totalWrong' | 'avgScore')}
            className={`h-10 min-w-[156px] cursor-pointer rounded-full border px-3.5 text-[11px] font-semibold transition-spring-fast focus:outline-none focus:ring-2 ${
              theme === 'dark'
                ? 'border-dark-border-medium bg-dark-800 text-dark-text-primary focus:border-accent-blue focus:ring-accent-blue/10'
                : 'border-[#e5e5e5] bg-white text-gray-900 focus:border-gray-900 focus:ring-gray-900/10'
            }`}
          >
            <option value="totalWrong">Sort by total wrong</option>
            <option value="avgScore">Sort by avg score</option>
            <option value="name">Sort by name</option>
          </select>

          <button
            type="button"
            onClick={handleSelectAll}
            className={`h-10 rounded-full border px-3.5 text-[11px] font-semibold transition-spring-fast ${
              theme === 'dark'
                ? 'border-dark-border-medium bg-dark-800 text-dark-text-primary hover:border-accent-blue hover:text-accent-blue'
                : 'border-[#e5e5e5] bg-white text-gray-900 hover:border-gray-900'
            }`}
          >
            {selectedStudents.size === filteredStudents.length ? 'Deselect all' : 'Select all'}
          </button>

          <span
            className={`text-xs font-medium ${
              theme === 'dark' ? 'text-dark-text-tertiary' : 'text-gray-500'
            }`}
          >
            {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}
          </span>

          {selectedStudents.size > 0 && (
            <button
              type="button"
              onClick={() => onCreateRemedialQuiz(Array.from(selectedStudents))}
              className={`h-10 rounded-full border px-4 text-[11px] font-semibold transition-spring hover:scale-[1.02] ${
                theme === 'dark'
                  ? 'border-accent-blue bg-accent-blue text-white hover:bg-accent-blue/90'
                  : 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Create quiz ({selectedStudents.size})
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 overflow-x-hidden px-1 py-1">
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
          <div
            className={`rounded-[24px] border-2 border-dashed p-8 text-center ${
              theme === 'dark'
                ? 'border-dark-border-medium bg-white/[0.02] text-dark-text-tertiary'
                : 'border-gray-300 bg-black/[0.02] text-gray-400'
            }`}
          >
            <p className="text-sm font-medium">No students match current filters.</p>
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
