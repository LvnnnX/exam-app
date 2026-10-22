'use client';

import React, { useState, useTransition } from 'react';
import { FolderTree } from 'lucide-react';
import CategoryTreeView from '@/src/features/kategori/CategoryTreeView';
import { getCategoryTreeAction } from '@/src/features/kategori/actions';
import type { SubjectNode } from '@/src/features/kategori/types';

type KategoriClientProps = {
  initialTree: SubjectNode[];
};

export default function KategoriClient({ initialTree }: KategoriClientProps) {
  const [tree, setTree] = useState<SubjectNode[]>(initialTree);
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      try {
        const next = await getCategoryTreeAction();
        if (next.success && next.tree) {
          setTree(next.tree);
        }
      } catch (err) {
        console.error('Failed to reload categories:', err);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <FolderTree size={24} className="text-highlight" />
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-fg">Manajemen Kategori & Visibilitas (HS-07)</h1>
          <p className="text-xs text-fg-muted">
            Pohon hierarki Mapel &rarr; Bab &rarr; Sub-bab &bull; Cascade visibilitas &bull; Penghitungan jumlah soal otomatis
          </p>
        </div>
      </div>

      {isPending && (
        <div className="text-xs text-center text-primary font-medium animate-pulse py-1">
          Memperbarui data kategori...
        </div>
      )}

      <CategoryTreeView tree={tree} onRefresh={handleRefresh} />
    </div>
  );
}
