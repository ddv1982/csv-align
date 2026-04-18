import { getResultLabel } from '../features/results/presentation';
import { SummaryResponse } from '../types/api';
import { SectionCard } from './ui/SectionCard';

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
          containerClassName: 'kinetic-tone-accent',
          iconWrapClassName: 'kinetic-tone-accent-strong',
          titleClassName: 'kinetic-copy',
          summaryClassName: 'kinetic-copy',
          detailClassName: 'kinetic-muted',
          icon: 'IG',
        }
      : null,
    summary.duplicates_a > 0 || summary.duplicates_b > 0
      ? {
          key: 'duplicates',
          title: 'Duplicate keys detected',
          summary: `Duplicates found: ${summary.duplicates_a} in File A, ${summary.duplicates_b} in File B`,
          details: ['Rows with duplicate selected keys can produce repeated matches or one-sided results and are worth reviewing before export.'],
          containerClassName: 'kinetic-tone-warning',
          iconWrapClassName: 'kinetic-tone-warning-strong',
          titleClassName: 'kinetic-copy',
          summaryClassName: 'kinetic-copy',
          detailClassName: 'kinetic-muted',
          icon: 'DP',
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
      surface: 'kinetic-tone-success',
      iconBg: 'kinetic-tone-success-strong',
      iconText: '',
      valueText: 'kinetic-copy',
      labelText: 'kinetic-copy',
      descriptionText: 'kinetic-muted',
      icon: 'MT',
    },
    {
      label: 'Mismatches',
      value: summary.mismatches,
      description: describeShare(summary.mismatches),
      surface: 'kinetic-tone-warning',
      iconBg: 'kinetic-tone-warning-strong',
      iconText: '',
      valueText: 'kinetic-copy',
      labelText: 'kinetic-copy',
      descriptionText: 'kinetic-muted',
      icon: 'MM',
    },
    {
      label: getResultLabel('missing_left'),
      value: summary.missing_left,
      description: describeShare(summary.missing_left),
      surface: 'kinetic-tone-accent',
      iconBg: 'kinetic-tone-accent-strong',
      iconText: '',
      valueText: 'kinetic-copy',
      labelText: 'kinetic-copy',
      descriptionText: 'kinetic-muted',
      icon: '<A',
    },
    {
      label: getResultLabel('missing_right'),
      value: summary.missing_right,
      description: describeShare(summary.missing_right),
      surface: 'kinetic-tone-danger',
      iconBg: 'kinetic-tone-danger-strong',
      iconText: '',
      valueText: 'kinetic-copy',
      labelText: 'kinetic-copy',
      descriptionText: 'kinetic-muted',
      icon: 'B>',
    },
  ];

  return (
    <SectionCard
      eyebrow="Step 3 · Results"
      title={<span className="text-lg">Comparison Summary</span>}
      headingLevel="h3"
      description="Review the overall match quality before drilling into filtered result rows."
      className="overflow-hidden"
      icon={<span aria-hidden="true">ST</span>}
      action={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="kinetic-panel px-4 py-3">
            <div className="hud-label">File A</div>
            <div className="kinetic-muted mt-1 text-sm">
              <span className="kinetic-copy font-semibold">{summary.total_rows_a}</span> rows
            </div>
            <div className="kinetic-muted mt-1 max-w-[280px] truncate text-xs" title={fileAName}>
              {fileAName}
            </div>
          </div>
          <div className="kinetic-panel px-4 py-3">
            <div className="hud-label">File B</div>
            <div className="kinetic-muted mt-1 text-sm">
              <span className="kinetic-copy font-semibold">{summary.total_rows_b}</span> rows
            </div>
            <div className="kinetic-muted mt-1 max-w-[280px] truncate text-xs" title={fileBName}>
              {fileBName}
            </div>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="kinetic-panel p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <p className="hud-label">Match rate</p>
              <p className="kinetic-copy mt-0.5 text-sm font-medium">Match rate of comparable rows</p>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="display-title kinetic-copy text-4xl">{matchPercent}%</span>
              <span className="kinetic-muted text-xs">{summary.matches} of {comparableTotal} rows</span>
            </div>
          </div>
          <div className="kinetic-frame mt-4 h-3 w-full overflow-hidden bg-[rgba(255,255,255,0.02)]">
            <div
              className="h-full bg-[linear-gradient(90deg,rgba(110,231,255,0.3),rgba(110,231,255,1),rgba(255,211,110,0.75))] transition-all duration-500"
              style={{ width: `${matchPercent}%` }}
            />
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <p className="hud-label">Outcome breakdown</p>
              <p className="kinetic-muted mt-0.5 text-sm">How each comparable row was classified.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {comparableStats.map((stat) => (
              <div
                key={stat.label}
                className={`kinetic-panel p-4 ${stat.surface}`}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className={`${stat.iconBg} ${stat.iconText} flex h-10 w-10 items-center justify-center border font-mono text-xs uppercase tracking-[0.18em]`}>
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
              <div key={banner.key} className={`kinetic-panel p-4 ${banner.containerClassName}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border font-mono text-xs uppercase tracking-[0.18em] ${banner.iconWrapClassName}`}>
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
