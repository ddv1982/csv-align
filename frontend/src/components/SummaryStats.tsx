import { buildSummaryOverview } from '../features/results/presentation';
import { SummaryResponse } from '../types/api';
import { ChartBarSquareIcon, CheckBadgeIcon, ExclamationCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from './icons';
import { SectionCard } from './ui/SectionCard';

interface SummaryStatsProps {
  summary: SummaryResponse;
  fileAName: string;
  fileBName: string;
}

export function SummaryStats({ summary, fileAName, fileBName }: SummaryStatsProps) {
  const { comparableTotal, matchPercent, comparableStats, infoBanners } = buildSummaryOverview(summary);

  return (
    <SectionCard
      eyebrow="Step 3 · Results"
      title={<span className="text-lg">Comparison Summary</span>}
      headingLevel="h3"
      description="Review the overall match quality before drilling into filtered result rows."
      className="overflow-hidden"
      icon={<ChartBarSquareIcon className="h-5 w-5" />}
      action={
        <div className="summary-file-grid grid gap-3 sm:grid-cols-2">
          <div className="kinetic-panel summary-file-panel px-4 py-3">
            <div className="hud-label">File A</div>
            <div className="kinetic-muted mt-1 text-sm">
              <span className="kinetic-copy font-semibold">{summary.total_rows_a}</span> rows
            </div>
            <div className="kinetic-muted file-name mt-1 max-w-[280px] truncate text-xs" title={fileAName}>
              {fileAName}
            </div>
          </div>
          <div className="kinetic-panel summary-file-panel px-4 py-3">
            <div className="hud-label">File B</div>
            <div className="kinetic-muted mt-1 text-sm">
              <span className="kinetic-copy font-semibold">{summary.total_rows_b}</span> rows
            </div>
            <div className="kinetic-muted file-name mt-1 max-w-[280px] truncate text-xs" title={fileBName}>
              {fileBName}
            </div>
          </div>
        </div>
      }
    >
      <div className="summary-main space-y-6">
        <div className="kinetic-panel summary-match-rate p-5">
          <div className="summary-match-rate-head flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <div>
              <p className="hud-label">Match rate</p>
              <p className="kinetic-copy mt-0.5 text-sm font-medium">Match rate of comparable rows</p>
            </div>
            <div className="summary-match-rate-value flex items-baseline gap-2">
              <span className="display-title kinetic-copy text-4xl">{matchPercent}%</span>
              <span className="kinetic-muted text-xs">{summary.matches} of {comparableTotal} rows</span>
            </div>
          </div>
          <div className="kinetic-frame summary-progress mt-4 h-3 w-full overflow-hidden">
            <div
              className="kinetic-progress-fill h-full transition-all duration-500"
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
            <div className="summary-stat-grid grid grid-cols-2 gap-4 md:grid-cols-4">
              {comparableStats.map((stat) => (
                <div
                  key={stat.label}
                  className={`kinetic-panel summary-stat p-4 kinetic-tone-${stat.tone}`}
                >
                  <div className="summary-stat-head mb-3 flex items-center justify-between gap-3">
                    <div className={`summary-stat-icon kinetic-tone-${stat.tone}-strong flex h-10 w-10 items-center justify-center border font-mono text-xs uppercase tracking-[0.18em]`}>
                      {stat.tone === 'success' && <CheckBadgeIcon className="h-5 w-5" />}
                      {stat.tone === 'warning' && <ExclamationCircleIcon className="h-5 w-5" />}
                      {stat.tone === 'accent' && stat.icon}
                      {stat.tone === 'danger' && stat.icon}
                    </div>
                    <span className="kinetic-copy summary-stat-value text-2xl font-bold tabular-nums">{stat.value}</span>
                  </div>
                  <p className="kinetic-copy summary-stat-label text-sm font-semibold">{stat.label}</p>
                  <p className="kinetic-muted summary-stat-description mt-0.5 text-xs">{stat.description}</p>
                </div>
              ))}
            </div>
        </div>

        {infoBanners.length > 0 && (
          <div className="summary-banners space-y-4">
            {infoBanners.map((banner) => (
              <div key={banner.title} className={`kinetic-panel summary-banner p-4 kinetic-tone-${banner.tone}`}>
                <div className="flex items-start gap-3">
                  <div className={`summary-banner-icon kinetic-tone-${banner.tone}-strong mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center border font-mono text-xs uppercase tracking-[0.18em]`}>
                    {banner.tone === 'accent' ? <InformationCircleIcon className="h-5 w-5" /> : <ExclamationTriangleIcon className="h-5 w-5" />}
                  </div>
                  <div className="summary-banner-copy space-y-1.5">
                    <p className="kinetic-copy summary-banner-title text-sm font-semibold">{banner.title}</p>
                    <p className="kinetic-copy summary-banner-summary text-sm font-medium">{banner.summary}</p>
                    {banner.details.map((detail) => (
                      <p key={detail} className="kinetic-muted summary-banner-detail text-sm leading-6">
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
