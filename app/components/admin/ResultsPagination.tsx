"use client";

import React from 'react';

type ResultsPaginationProps = {
  totalResults: number;
  itemsPerPage: number;
  resultPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (size: number) => void;
  theme?: 'light' | 'dark';
};

export default function ResultsPagination({
  totalResults,
  itemsPerPage,
  resultPage,
  onPageChange,
  onItemsPerPageChange,
  theme = 'dark',
}: ResultsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalResults / itemsPerPage));

  return (
    <div className={`border-t px-6 py-4 ${theme === 'dark' ? 'border-dark-border bg-dark-750' : 'border-gray-200 bg-gray-50'}`}>
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-0 sm:hidden">
        <label className={`text-xs font-semibold uppercase tracking-[0.12em] ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Rows</label>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className={`h-9 rounded-full border px-3 text-xs font-semibold focus:outline-none ${theme === 'dark' ? 'border-dark-border bg-dark-800 text-dark-text-primary focus:border-accent-blue' : 'border-gray-300 bg-white text-gray-700 focus:border-[#111111]'}`}
        >
          {[20, 50, 100].map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(resultPage - 1)}
          disabled={resultPage === 0}
          className={`relative inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50 ${theme === 'dark' ? 'border-dark-border bg-dark-800 text-dark-text-primary hover:bg-dark-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(resultPage + 1)}
          disabled={resultPage + 1 >= totalPages}
          className={`ml-3 relative inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50 ${theme === 'dark' ? 'border-dark-border bg-dark-800 text-dark-text-primary hover:bg-dark-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          Next
        </button>
      </div>

      <div className="hidden sm:flex sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <label className={`text-xs font-semibold uppercase tracking-[0.12em] ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-600'}`}>Rows</label>
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className={`h-9 rounded-full border px-3 text-xs font-semibold focus:outline-none ${theme === 'dark' ? 'border-dark-border bg-dark-800 text-dark-text-primary focus:border-accent-blue' : 'border-gray-300 bg-white text-gray-700 focus:border-[#111111]'}`}
          >
            {[20, 50, 100].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <p className={`text-sm ${theme === 'dark' ? 'text-dark-text-secondary' : 'text-gray-700'}`}>
            Showing <span className="font-medium">{totalResults === 0 ? 0 : resultPage * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min((resultPage + 1) * itemsPerPage, totalResults)}</span> of{' '}
            <span className="font-medium">{totalResults}</span> results
          </p>
        </div>

        <nav className="relative z-0 inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
          <button
            onClick={() => onPageChange(resultPage - 1)}
            disabled={resultPage === 0}
            className={`relative inline-flex items-center rounded-l-md border px-2 py-2 text-sm font-medium disabled:opacity-50 ${theme === 'dark' ? 'border-dark-border bg-dark-800 text-dark-text-secondary hover:bg-dark-700' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            <span className="sr-only">Previous</span>
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => onPageChange(i)}
              className={`relative inline-flex items-center border px-4 py-2 text-sm font-medium ${resultPage === i
                ? (theme === 'dark' ? 'z-10 border-accent-blue bg-accent-blue/20 text-accent-blue' : 'z-10 border-indigo-500 bg-indigo-50 text-indigo-600')
                : (theme === 'dark' ? 'border-dark-border bg-dark-800 text-dark-text-secondary hover:bg-dark-700' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50')
                }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => onPageChange(resultPage + 1)}
            disabled={resultPage + 1 >= totalPages}
            className={`relative inline-flex items-center rounded-r-md border px-2 py-2 text-sm font-medium disabled:opacity-50 ${theme === 'dark' ? 'border-dark-border bg-dark-800 text-dark-text-secondary hover:bg-dark-700' : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'}`}
          >
            <span className="sr-only">Next</span>
            <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  );
}
