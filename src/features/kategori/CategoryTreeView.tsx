'use client';

import React, { useState } from 'react';
import {
  ChevronRight, ChevronDown, Eye, EyeOff, Plus, Trash2, Folder, BookOpen, Layers, X,
} from 'lucide-react';
import {
  toggleSubjectAction,
  toggleChapterAction,
  toggleTopicAction,
  createSubjectAction,
  createChapterAction,
  createTopicAction,
  deleteTopicAction,
} from './actions';
import type { SubjectNode, ChapterNode, TopicNode, Visibility } from './types';

type CategoryTreeViewProps = {
  tree: SubjectNode[];
  onRefresh: () => void;
};

export default function CategoryTreeView({ tree, onRefresh }: CategoryTreeViewProps) {
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set(tree.map((s) => s.id))
  );
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(
    new Set(tree.flatMap((s) => s.chapters.map((c) => c.id)))
  );
  const [modalType, setModalType] = useState<'subject' | 'chapter' | 'topic' | null>(null);
  const [modalTargetId, setModalTargetId] = useState<string>('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleExpandSubject = (id: string) => {
    const next = new Set(expandedSubjects);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedSubjects(next);
  };

  const toggleExpandChapter = (id: string) => {
    const next = new Set(expandedChapters);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedChapters(next);
  };

  const handleToggleSubject = async (s: SubjectNode) => {
    const next: Visibility = s.visibility === 'shown' ? 'hidden' : 'shown';
    await toggleSubjectAction(s.id, next);
    onRefresh();
  };

  const handleToggleChapter = async (c: ChapterNode) => {
    const next: Visibility = c.visibility === 'shown' ? 'hidden' : 'shown';
    await toggleChapterAction(c.id, next);
    onRefresh();
  };

  const handleToggleTopic = async (t: TopicNode) => {
    const next: Visibility = t.visibility === 'shown' ? 'hidden' : 'shown';
    await toggleTopicAction(t.id, next);
    onRefresh();
  };

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm('Yakin ingin menghapus sub-bab ini?')) return;
    setError(null);
    const res = await deleteTopicAction(topicId);
    if (!res.success) {
      alert(res.error);
    } else {
      onRefresh();
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    setError(null);

    try {
      if (modalType === 'subject') {
        const res = await createSubjectAction(newName.trim());
        if (!res.success) throw new Error(res.error);
      } else if (modalType === 'chapter') {
        const res = await createChapterAction(modalTargetId, newName.trim());
        if (!res.success) throw new Error(res.error);
      } else if (modalType === 'topic') {
        const res = await createTopicAction(modalTargetId, newName.trim());
        if (!res.success) throw new Error(res.error);
      }
      setModalType(null);
      setNewName('');
      onRefresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-fg">Pohon Hierarki Kategori & Visibilitas</h2>
        <button
          type="button"
          onClick={() => { setModalType('subject'); setNewName(''); setError(null); }}
          className="px-3.5 py-1.5 rounded-2xl text-xs font-semibold clay-primary flex items-center gap-1.5"
        >
          <Plus size={14} /> Tambah Mapel
        </button>
      </div>

      <div className="rounded-3xl glass border border-line overflow-hidden shadow-xs divide-y divide-line/60">
        {tree.length === 0 ? (
          <div className="p-8 text-center text-xs text-fg-subtle">
            Belum ada kategori. Buat mapel pertama kamu.
          </div>
        ) : (
          tree.map((s) => {
            const isSubExpanded = expandedSubjects.has(s.id);
            return (
              <div key={s.id} className="flex flex-col bg-canvas/30">
                {/* Subject Row */}
                <div className="flex items-center justify-between p-3 px-4 hover:bg-well/40 transition-colors">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleExpandSubject(s.id)}
                      className="p-1 rounded-lg hover:bg-well text-fg-subtle"
                    >
                      {isSubExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <BookOpen size={16} className="text-primary" />
                    <span className="font-bold text-sm text-fg">{s.name}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full well text-fg-muted font-mono">
                      {s.question_count} soal
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setModalType('chapter'); setModalTargetId(s.id); setNewName(''); setError(null); }}
                      className="p-1.5 px-2.5 rounded-xl well hover:bg-well-hover text-xs font-medium text-fg flex items-center gap-1 border border-line"
                    >
                      <Plus size={13} /> Tambah Bab
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleSubject(s)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-transform active:scale-95 ${
                        s.visibility === 'shown'
                          ? 'bg-pine-500/15 border-pine-500/30 text-pine-700 dark:text-pine-300'
                          : 'bg-brick-500/15 border-brick-500/30 text-brick-700 dark:text-brick-300'
                      }`}
                      title={s.visibility === 'shown' ? 'Mapel Tampil (Klik untuk sembunyikan semua bab di bawahnya)' : 'Mapel Sembunyi (Semua anak otomatis hidden ke siswa)'}
                    >
                      {s.visibility === 'shown' ? <Eye size={12} /> : <EyeOff size={12} />}
                      {s.visibility === 'shown' ? 'Shown' : 'Hidden (Cascade)'}
                    </button>
                  </div>
                </div>

                {/* Chapters */}
                {isSubExpanded && (
                  <div className="pl-6 sm:pl-10 pr-4 pb-2 flex flex-col gap-1.5 border-t border-line/40 pt-2">
                    {s.chapters.length === 0 ? (
                      <div className="p-2 text-xs text-fg-subtle italic">Belum ada bab di mapel ini.</div>
                    ) : (
                      s.chapters.map((c) => {
                        const isChExpanded = expandedChapters.has(c.id);
                        const isEffectivelyHidden = s.visibility === 'hidden' || c.visibility === 'hidden';

                        return (
                          <div key={c.id} className="rounded-2xl well border border-line/80 overflow-hidden">
                            {/* Chapter Header */}
                            <div className="flex items-center justify-between p-2.5 px-3 hover:bg-well-hover transition-colors">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandChapter(c.id)}
                                  className="p-1 rounded-lg text-fg-subtle"
                                >
                                  {isChExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                <Folder size={15} className="text-highlight" />
                                <span className="font-semibold text-xs text-fg">{c.name}</span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-canvas text-fg-muted font-mono">
                                  {c.question_count}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => { setModalType('topic'); setModalTargetId(c.id); setNewName(''); setError(null); }}
                                  className="p-1 px-2 rounded-lg bg-canvas text-[11px] font-medium text-fg flex items-center gap-1 border border-line"
                                >
                                  <Plus size={12} /> Sub-bab
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleChapter(c)}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    c.visibility === 'shown'
                                      ? 'bg-pine-500/15 border-pine-500/30 text-pine-700 dark:text-pine-300'
                                      : 'bg-brick-500/15 border-brick-500/30 text-brick-700 dark:text-brick-300'
                                  }`}
                                  title={s.visibility === 'hidden' ? 'Induk Mapel tersembunyi (bab ini otomatis hidden ke siswa)' : 'Toggle visibilitas bab'}
                                >
                                  {c.visibility === 'shown' ? <Eye size={10} /> : <EyeOff size={10} />}
                                  {c.visibility}
                                  {s.visibility === 'hidden' && ' (induk hidden)'}
                                </button>
                              </div>
                            </div>

                            {/* Topics */}
                            {isChExpanded && (
                              <div className="pl-8 pr-3 pb-2 pt-1 flex flex-col gap-1 border-t border-line/40">
                                {c.topics.length === 0 ? (
                                  <div className="text-[11px] text-fg-subtle italic py-1">Belum ada sub-bab.</div>
                                ) : (
                                  c.topics.map((t) => (
                                    <div
                                      key={t.id}
                                      className="flex items-center justify-between p-1.5 px-2.5 rounded-xl bg-canvas/60 border border-line text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Layers size={13} className="text-fg-subtle" />
                                        <span className="text-fg">{t.name}</span>
                                        <span className="text-[10px] text-fg-subtle font-mono">
                                          ({t.question_count} soal)
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleTopic(t)}
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                            t.visibility === 'shown'
                                              ? 'bg-pine-500/15 border-pine-500/30 text-pine-700 dark:text-pine-300'
                                              : 'bg-brick-500/15 border-brick-500/30 text-brick-700 dark:text-brick-300'
                                          }`}
                                          title={isEffectivelyHidden ? 'Jalur induk hidden (sub-bab ini otomatis hidden ke siswa)' : 'Toggle visibilitas sub-bab'}
                                        >
                                          {t.visibility === 'shown' ? <Eye size={10} /> : <EyeOff size={10} />}
                                          {t.visibility}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={t.question_count > 0}
                                          onClick={() => handleDeleteTopic(t.id)}
                                          className="p-1 rounded-lg text-fg-subtle hover:text-danger disabled:opacity-30 disabled:hover:text-fg-subtle"
                                          title={t.question_count > 0 ? 'Tidak bisa dihapus karena masih ada soal (BS-06)' : 'Hapus Sub-bab'}
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Tambah */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-glass-scrim backdrop-blur-xs">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-sm p-5 rounded-3xl glass-sheet shadow-2xl border border-line-strong flex flex-col gap-3"
          >
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h3 className="font-bold text-fg">
                {modalType === 'subject' && 'Tambah Mata Pelajaran'}
                {modalType === 'chapter' && 'Tambah Bab Baru'}
                {modalType === 'topic' && 'Tambah Sub-Bab Baru'}
              </h3>
              <button type="button" onClick={() => setModalType(null)} className="p-1 rounded-lg text-fg-subtle">
                <X size={18} />
              </button>
            </div>

            {error && (
              <div className="p-2 rounded-xl bg-brick-50 text-danger text-xs border border-brick-200">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-fg-muted block mb-1">Nama:</label>
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Contoh: Pemrograman Dasar"
                className="w-full p-2.5 rounded-xl well border border-line text-xs text-fg focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-3 py-1.5 rounded-xl text-xs hover:bg-well text-fg-muted"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={loading || !newName.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold clay-primary disabled:opacity-50"
              >
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
