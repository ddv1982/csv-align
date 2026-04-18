import { getResultLabel } from '../features/results/presentation';
import { SummaryResponse } from '../types/api';
import { SectionCard } from './ui/SectionCard';
import {
  ChartBarSquareIcon,
  CheckBadgeIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  RectangleStackIcon,
  ArrowsRightLeftIcon,
} from './icons';

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
          containerClassName: 'border-sky-200/85 bg-sky-50/95 shadow-[0_18px_42px_-34px_rgba(14,165,233,0.28)] dark:border-sky-500/30 dark:bg-sky-950/24 dark:shadow-[0_18px_44px_-36px_rgba(14,165,233,0.22)]',
          iconWrapClassName: 'bg-sky-100 text-sky-700 ring-sky-200/80',
          titleClassName: 'text-sky-950 dark:text-sky-100',
          summaryClassName: 'text-sky-800 dark:text-sky-200',
          detailClassName: 'text-sky-700 dark:text-sky-300',
          icon: (
            <DocumentTextIcon className="h-5 w-5" />
          ),
        }
      : null,
    summary.duplicates_a > 0 || summary.duplicates_b > 0
      ? {
          key: 'duplicates',
          title: 'Duplicate keys detected',
          summary: `Duplicates found: ${summary.duplicates_a} in File A, ${summary.duplicates_b} in File B`,
          details: ['Rows with duplicate selected keys can produce repeated matches or one-sided results and are worth reviewing before export.'],
          containerClassName: 'border-amber-200/85 bg-amber-50/95 shadow-[0_18px_42px_-34px_rgba(245,158,11,0.28)] dark:border-amber-500/30 dark:bg-amber-950/24 dark:shadow-[0_18px_44px_-36px_rgba(245,158,11,0.22)]',
          iconWrapClassName: 'bg-amber-100 text-amber-700 ring-amber-200/80',
          titleClassName: 'text-amber-950 dark:text-amber-100',
          summaryClassName: 'text-amber-800 dark:text-amber-200',
          detailClassName: 'text-amber-700 dark:text-amber-300',
          icon: (
            <RectangleStackIcon className="h-5 w-5" />
          ),
        }
      : null,
  ].filter((banner): banner is NonNullable<typeof banner> => banner !== null);

  const describeShare = (value: number) =>
    comparableTotal > 0
      ? `${Math.round((value / comparableTotal) * 100)}% of comparable rows`
      : 'No comparable rows';

  const comparableStats = [
    {
      label: 'Matches',
      value: summary.matches,
      description: describeShare(summary.matches),
      surface: 'border border-emerald-200/80 bg-emerald-50/90 shadow-[0_18px_34px_-30px_rgba(16,185,129,0.24)] dark:border-emerald-500/25 dark:bg-emerald-950/22 dark:shadow-none',
      iconBg: 'bg-emerald-100 ring-emerald-200/80',
      iconText: 'text-emerald-700',
      valueText: 'text-slate-950 dark:text-slate-50',
      labelText: 'text-slate-700 dark:text-slate-200',
      descriptionText: 'text-slate-500 dark:text-slate-400',
      icon: (
        <CheckBadgeIcon className="w-5 h-5" />
      ),
    },
    {
      label: 'Mismatches',
      value: summary.mismatches,
      description: describeShare(summary.mismatches),
      surface: 'border border-amber-200/80 bg-amber-50/90 shadow-[0_18px_34px_-30px_rgba(245,158,11,0.22)] dark:border-amber-500/25 dark:bg-amber-950/22 dark:shadow-none',
      iconBg: 'bg-amber-100 ring-amber-200/80',
      iconText: 'text-amber-700',
      valueText: 'text-slate-950 dark:text-slate-50',
      labelText: 'text-slate-700 dark:text-slate-200',
      descriptionText: 'text-slate-500 dark:text-slate-400',
      icon: (
        <ExclamationTriangleIcon className="w-5 h-5" />
      ),
    },
    {
      label: getResultLabel('missing_left'),
      value: summary.missing_left,
      description: describeShare(summary.missing_left),
      surface: 'border border-sky-200/80 bg-sky-50/90 shadow-[0_18px_34px_-30px_rgba(14,165,233,0.22)] dark:border-sky-500/25 dark:bg-sky-950/22 dark:shadow-none',
      iconBg: 'bg-sky-100 ring-sky-200/80',
      iconText: 'text-sky-700',
      valueText: 'text-slate-950 dark:text-slate-50',
      labelText: 'text-slate-700 dark:text-slate-200',
      descriptionText: 'text-slate-500 dark:text-slate-400',
      icon: (
        <ArrowsRightLeftIcon className="w-5 h-5" />
      ),
    },
    {
      label: getResultLabel('missing_right'),
      value: summary.missing_right,
      description: describeShare(summary.missing_right),
      surface: 'border border-violet-200/80 bg-violet-50/90 shadow-[0_18px_34px_-30px_rgba(139,92,246,0.22)] dark:border-violet-500/25 dark:bg-violet-950/22 dark:shadow-none',
      iconBg: 'bg-violet-100 ring-violet-200/80',
      iconText: 'text-violet-700',
      valueText: 'text-slate-950 dark:text-slate-50',
      labelText: 'text-slate-700 dark:text-slate-200',
      descriptionText: 'text-slate-500 dark:text-slate-400',
      icon: (
        <ArrowsRightLeftIcon className="w-5 h-5" style={{ transform: 'rotate(180deg)' }} />
      ),
    },
  ];

  return (
    <SectionCard
      eyebrow="Step 3 · Results"
      title={<span className="text-lg">Comparison Summary</span>}
      headingLevel="h3"
      description="Review the overall match quality before drilling into filtered result rows."
      className="card overflow-hidden border-gray-200/90 bg-white shadow-xl shadow-gray-200/70 dark:border-gray-700/90 dark:bg-gray-900/85 dark:shadow-black/30"
      icon={
        <ChartBarSquareIcon className="h-5 w-5" />
      }
      action={
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
      }
    >
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200/90 bg-gray-50/90 p-5 shadow-sm shadow-gray-200/70 dark:border-gray-700/80 dark:bg-gray-950/40 dark:shadow-none">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Match rate</p>
              <p className="mt-0.5 text-sm font-medium text-gray-700 dark:text-gray-300">Match rate of comparable rows</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">{matchPercent}%</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{summary.matches} of {comparableTotal} rows</span>
            </div>
          </div>
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 transition-all duration-500"
              style={{ width: `${matchPercent}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Outcome breakdown</p>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">How each comparable row was classified.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {comparableStats.map((stat) => (
              <div
                key={stat.label}
                className={`${stat.surface} rounded-xl p-4 transition-colors hover:border-gray-300 hover:bg-white dark:hover:border-gray-500 dark:hover:bg-gray-900/80`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className={`${stat.iconBg} ${stat.iconText} flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-inset shadow-sm shadow-white/40 dark:shadow-none`}>
                    {stat.icon}
                  </div>
                  <span className={`text-2xl font-bold tabular-nums ${stat.valueText}`}>{stat.value}</span>
                </div>
                <p className={`text-sm font-semibold ${stat.labelText}`}>{stat.label}</p>
                <p className={`mt-0.5 text-xs ${stat.descriptionText}`}>{stat.description}</p>
              </div>
            ))}
          </div>
        </div>

        {infoBanners.length > 0 && (
          <div className="space-y-4">
            {infoBanners.map((banner) => (
              <div key={banner.key} className={`rounded-2xl border p-4 shadow-sm shadow-gray-200/70 dark:shadow-none ${banner.containerClassName}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset shadow-sm shadow-white/40 dark:shadow-none ${banner.iconWrapClassName}`}>
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
    </SectionCard>
  );
}
