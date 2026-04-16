import { getResultLabel } from '../features/results/presentation';
import { SummaryResponse } from '../types/api';

interface SummaryStatsProps {
  summary: SummaryResponse;
  fileAName: string;
  fileBName: string;
}

export function SummaryStats({ summary, fileAName, fileBName }: SummaryStatsProps) {
  const comparableTotal = summary.matches + summary.mismatches + summary.missing_left + summary.missing_right;
  const ignoredTotal = summary.unkeyed_left + summary.unkeyed_right;
  const matchPercent = comparableTotal > 0 ? Math.round((summary.matches / comparableTotal) * 100) : 0;

  const infoBanners = [
    ignoredTotal > 0
      ? {
          key: 'ignored',
          title: 'Ignored rows',
          summary: `${summary.unkeyed_right} in File A, ${summary.unkeyed_left} in File B`,
          details: [
            'Ignored rows were not compared because the selected key was empty or matched a missing-value token after cleanup settings.',
            'Ignored rows may correspond to one-sided results on the other file, but they could not be matched confidently by key.',
          ],
          containerClassName: 'border-sky-200/90 bg-sky-50/95 dark:border-sky-500/40 dark:bg-sky-950/35',
          iconWrapClassName: 'bg-sky-100 text-sky-700 dark:bg-sky-400/28 dark:text-sky-100 dark:ring-sky-300/20',
          titleClassName: 'text-sky-950 dark:text-sky-100',
          summaryClassName: 'text-sky-800 dark:text-sky-200',
          detailClassName: 'text-sky-700 dark:text-sky-300',
          icon: (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
          ),
        }
      : null,
    summary.duplicates_a > 0 || summary.duplicates_b > 0
      ? {
          key: 'duplicates',
          title: 'Duplicate keys detected',
          summary: `Duplicates found: ${summary.duplicates_a} in File A, ${summary.duplicates_b} in File B`,
          details: ['Rows with duplicate selected keys can produce repeated matches or one-sided results and are worth reviewing before export.'],
          containerClassName: 'border-amber-200/90 bg-amber-50/95 dark:border-amber-500/40 dark:bg-amber-950/35',
          iconWrapClassName: 'bg-amber-100 text-amber-700 dark:bg-amber-400/28 dark:text-amber-100 dark:ring-amber-300/20',
          titleClassName: 'text-amber-950 dark:text-amber-100',
          summaryClassName: 'text-amber-800 dark:text-amber-200',
          detailClassName: 'text-amber-700 dark:text-amber-300',
          icon: (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
            </svg>
          ),
        }
      : null,
  ].filter((banner): banner is NonNullable<typeof banner> => banner !== null);

  const comparableStats = [
    {
      label: 'Matches',
      value: summary.matches,
      surface: 'border border-emerald-200/80 bg-emerald-50/80 shadow-sm shadow-emerald-100/70 dark:border-emerald-500/25 dark:bg-emerald-950/20 dark:shadow-none',
      iconBg: 'bg-emerald-100 dark:bg-emerald-400/28',
      iconText: 'text-emerald-700 dark:text-emerald-100',
      valueText: 'text-gray-900 dark:text-gray-100',
      labelText: 'text-gray-600 dark:text-gray-300',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    {
      label: 'Mismatches',
      value: summary.mismatches,
      surface: 'border border-amber-200/80 bg-amber-50/80 shadow-sm shadow-amber-100/70 dark:border-amber-500/25 dark:bg-amber-950/20 dark:shadow-none',
      iconBg: 'bg-amber-100 dark:bg-amber-400/28',
      iconText: 'text-amber-700 dark:text-amber-100',
      valueText: 'text-gray-900 dark:text-gray-100',
      labelText: 'text-gray-600 dark:text-gray-300',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      label: getResultLabel('missing_left'),
      value: summary.missing_left,
      surface: 'border border-sky-200/80 bg-sky-50/80 shadow-sm shadow-sky-100/70 dark:border-sky-500/25 dark:bg-sky-950/20 dark:shadow-none',
      iconBg: 'bg-sky-100 dark:bg-sky-400/28',
      iconText: 'text-sky-700 dark:text-sky-100',
      valueText: 'text-gray-900 dark:text-gray-100',
      labelText: 'text-gray-600 dark:text-gray-300',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      ),
    },
    {
      label: getResultLabel('missing_right'),
      value: summary.missing_right,
      surface: 'border border-violet-200/80 bg-violet-50/80 shadow-sm shadow-violet-100/70 dark:border-violet-500/25 dark:bg-violet-950/20 dark:shadow-none',
      iconBg: 'bg-violet-100 dark:bg-violet-400/28',
      iconText: 'text-violet-700 dark:text-violet-100',
      valueText: 'text-gray-900 dark:text-gray-100',
      labelText: 'text-gray-600 dark:text-gray-300',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      ),
    },
  ];

  return (
    <div className="card overflow-hidden border-gray-200/90 bg-white shadow-xl shadow-gray-200/70 dark:border-gray-700/90 dark:bg-gray-900/85 dark:shadow-black/30">
      <div className="border-b border-gray-200/80 bg-gray-50/80 px-6 py-5 dark:border-gray-700/80 dark:bg-gray-950/40">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Comparison Summary
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Review the overall match quality before drilling into filtered result rows.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200/90 bg-white/90 px-4 py-3 shadow-sm shadow-gray-200/70 dark:border-gray-700 dark:bg-gray-900/70 dark:shadow-none">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">File A</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{summary.total_rows_a}</span> rows
              </div>
              <div className="mt-1 max-w-[280px] truncate text-xs text-gray-500 dark:text-gray-400" title={fileAName}>
                {fileAName}
              </div>
            </div>
            <div className="rounded-xl border border-gray-200/90 bg-white/90 px-4 py-3 shadow-sm shadow-gray-200/70 dark:border-gray-700 dark:bg-gray-900/70 dark:shadow-none">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">File B</div>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                <span className="font-semibold text-gray-900 dark:text-gray-100">{summary.total_rows_b}</span> rows
              </div>
              <div className="mt-1 max-w-[280px] truncate text-xs text-gray-500 dark:text-gray-400" title={fileBName}>
                {fileBName}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-6 py-6">
        <div className="rounded-2xl border border-gray-200/90 bg-gray-50/90 p-4 shadow-sm shadow-gray-200/70 dark:border-gray-700/80 dark:bg-gray-950/40 dark:shadow-none">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Match rate of comparable rows</span>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{matchPercent}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 transition-all duration-500"
              style={{ width: `${matchPercent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {comparableStats.map((stat) => (
            <div
              key={stat.label}
              className={`${stat.surface} rounded-xl p-4 transition-colors hover:border-gray-300 hover:bg-white dark:hover:border-gray-500 dark:hover:bg-gray-900/80`}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className={`${stat.iconBg} ${stat.iconText} flex h-9 w-9 items-center justify-center rounded-lg border border-current/10 dark:ring-1 dark:ring-inset dark:ring-white/10`}>
                  {stat.icon}
                </div>
                <span className={`text-2xl font-bold ${stat.valueText}`}>{stat.value}</span>
              </div>
              <p className={`text-sm font-medium ${stat.labelText}`}>{stat.label}</p>
            </div>
          ))}
        </div>

        {infoBanners.length > 0 && (
          <div className="space-y-4">
            {infoBanners.map((banner) => (
              <div key={banner.key} className={`rounded-2xl border p-4 shadow-sm shadow-gray-200/70 dark:shadow-none ${banner.containerClassName}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-current/10 ${banner.iconWrapClassName}`}>
                    {banner.icon}
                  </div>
                  <div className="space-y-1.5">
                    <p className={`text-sm font-semibold ${banner.titleClassName}`}>{banner.title}</p>
                    <p className={`text-sm font-medium ${banner.summaryClassName}`}>{banner.summary}</p>
                    {banner.details.map((detail) => (
                      <p key={detail} className={`text-sm leading-6 ${banner.detailClassName}`}>
                        {detail}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
