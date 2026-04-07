import { useState } from 'react';
import { ResultResponse } from '../types/api';

interface ResultsTableProps {
  results: ResultResponse[];
}

export function ResultsTable({ results }: ResultsTableProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const getResultBadge = (resultType: string) => {
    switch (resultType) {
      case 'match':
        return { bg: 'bg-green-100', text: 'text-green-700', label: 'Match' };
      case 'mismatch':
        return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Mismatch' };
      case 'missing_left':
        return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Missing Left' };
      case 'missing_right':
        return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Missing Right' };
      default:
        if (resultType.startsWith('duplicate')) {
          return { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Duplicate' };
        }
        return { bg: 'bg-gray-100', text: 'text-gray-700', label: resultType };
    }
  };

  const getRowClassName = (resultType: string) => {
    switch (resultType) {
      case 'match':
        return 'bg-green-50 hover:bg-green-100';
      case 'mismatch':
        return 'bg-yellow-50 hover:bg-yellow-100';
      case 'missing_left':
        return 'bg-blue-50 hover:bg-blue-100';
      case 'missing_right':
        return 'bg-purple-50 hover:bg-purple-100';
      default:
        if (resultType.startsWith('duplicate')) {
          return 'bg-orange-50 hover:bg-orange-100';
        }
        return 'bg-gray-50 hover:bg-gray-100';
    }
  };

  if (results.length === 0) {
    return (
      <div className="card p-12 text-center">
        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-gray-500">No results match the selected filter</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-24">
                Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Key
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-blue-600 uppercase tracking-wider">
                File A Values
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-green-600 uppercase tracking-wider">
                File B Values
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">
                Details
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {results.map((result, idx) => {
              const badge = getResultBadge(result.result_type);
              const isExpanded = expandedRow === idx;
              
              return (
                <>
                  <tr
                    key={idx}
                    className={`transition-colors ${getRowClassName(result.result_type)}`}
                  >
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {result.key.join(', ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {result.values_a.length > 0 ? (
                        <div className="text-sm text-gray-700">
                          {result.values_a.map((v, i) => (
                            <span key={i} className="inline-block mr-2">
                              {v}
                              {i < result.values_a.length - 1 && ','}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {result.values_b.length > 0 ? (
                        <div className="text-sm text-gray-700">
                          {result.values_b.map((v, i) => (
                            <span key={i} className="inline-block mr-2">
                              {v}
                              {i < result.values_b.length - 1 && ','}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {result.differences.length > 0 ? (
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : idx)}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
                        >
                          {result.differences.length} diff{result.differences.length > 1 ? 's' : ''}
                          <svg
                            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                  
                  {/* Expanded Differences */}
                  {isExpanded && result.differences.length > 0 && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-4">
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-gray-700 mb-2">Value Differences:</p>
                          {result.differences.map((diff, diffIdx) => (
                            <div
                              key={diffIdx}
                              className="flex items-center gap-4 p-3 bg-white rounded-lg border border-gray-200"
                            >
                              <div className="flex-1">
                                <p className="text-xs text-gray-500 mb-1">
                                  {diff.column_a} → {diff.column_b}
                                </p>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 bg-red-100 text-red-700 text-sm rounded">
                                    {diff.value_a}
                                  </span>
                                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                  </svg>
                                  <span className="px-2 py-1 bg-green-100 text-green-700 text-sm rounded">
                                    {diff.value_b}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Pagination hint */}
      {results.length > 50 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            Showing {results.length} results. Use filters to narrow down.
          </p>
        </div>
      )}
    </div>
  );
}
