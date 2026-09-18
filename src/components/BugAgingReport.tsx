import { useMemo, useState } from 'react';
import type { BugReportIssue, DashboardIssue } from '../types/jira';
import { StoryTimeStats } from './StoryTimeStats';

interface BugAgingReportProps {
  issues: BugReportIssue[];
  sprintIssues: DashboardIssue[];
}

const PRIORITY_ORDER = ['Highest', 'High', 'Medium', 'Low', 'Lowest', 'None'];
const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcDay(value: string): number {
  const date = new Date(value);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function formatDay(value: number): string {
  const date = new Date(value);
  return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`;
}

function comparePriorities(left: string, right: string): number {
  const leftIndex = PRIORITY_ORDER.indexOf(left);
  const rightIndex = PRIORITY_ORDER.indexOf(right);
  const normalizedLeft = leftIndex === -1 ? PRIORITY_ORDER.length : leftIndex;
  const normalizedRight = rightIndex === -1 ? PRIORITY_ORDER.length : rightIndex;

  return normalizedLeft - normalizedRight || left.localeCompare(right);
}

function parseDateInput(value: string): number | null {
  if (value === '') {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

export function BugAgingReport({ issues, sprintIssues }: BugAgingReportProps) {
  const [activeTab, setActiveTab] = useState<'table' | 'timeStats'>('table');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const selectedStartDay = parseDateInput(dateFrom);
  const selectedEndDay = parseDateInput(dateTo);
  const invalidDateRange = selectedStartDay !== null && selectedEndDay !== null && selectedStartDay > selectedEndDay;

  const report = useMemo(() => {
    const completedIntervals = issues.flatMap((issue) =>
      issue.lastInProgressExitAt === null
        ? []
        : [{
            ...issue,
            reportedDay: toUtcDay(issue.reportedAt),
            exitDay: toUtcDay(issue.lastInProgressExitAt),
          }],
    );

    if (completedIntervals.length === 0 || invalidDateRange) {
      return null;
    }

    const firstReportedDay = Math.min(...completedIntervals.map((issue) => issue.reportedDay));
    const lastExitDay = Math.max(...completedIntervals.map((issue) => issue.exitDay));
    const startDay = selectedStartDay ?? firstReportedDay;
    const endDay = selectedEndDay ?? lastExitDay;

    if (startDay > lastExitDay || endDay < firstReportedDay) {
      return null;
    }

    const days: number[] = [];

    for (let day = startDay; day <= endDay; day += DAY_MS) {
      days.push(day);
    }

    const priorities = Array.from(new Set(completedIntervals.map((issue) => issue.priority))).sort(comparePriorities);
    const counts = new Map<string, number[]>();

    for (const priority of priorities) {
      counts.set(
        priority,
        days.map(
          (day) =>
            completedIntervals.filter(
              (issue) => issue.priority === priority && issue.reportedDay <= day && issue.exitDay >= day,
            ).length,
        ),
      );
    }

    const dayTotals = days.map((_, index) =>
      priorities.reduce((total, priority) => total + (counts.get(priority)?.[index] ?? 0), 0),
    );

    return { days, priorities, counts, dayTotals, includedCount: completedIntervals.length };
  }, [issues, invalidDateRange, selectedStartDay, selectedEndDay]);

  return (
    <section className="bug-aging-report">
      <div className="bug-aging-subtabs" role="tablist" aria-label="Bug aging report view">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'table'}
          className={`bug-aging-subtab ${activeTab === 'table' ? 'bug-aging-subtab-active' : ''}`}
          onClick={() => setActiveTab('table')}
        >
          Table
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'timeStats'}
          className={`bug-aging-subtab ${activeTab === 'timeStats' ? 'bug-aging-subtab-active' : ''}`}
          onClick={() => setActiveTab('timeStats')}
        >
          TimeStats
        </button>
      </div>

      {activeTab === 'timeStats' ? (
        <StoryTimeStats issues={sprintIssues} issueType="Bug" />
      ) : (
        <>
          <div className="bug-aging-filters">
            <label className="bug-aging-date-field">
              <span>Date from</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </label>
            <label className="bug-aging-date-field">
              <span>Date to</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="bug-aging-date-clear"
              disabled={dateFrom === '' && dateTo === ''}
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
            >
              Clear dates
            </button>
          </div>

          {invalidDateRange ? (
            <div className="bug-aging-empty">Date from must be earlier than or equal to Date to.</div>
          ) : report === null ? (
            <div className="bug-aging-empty">No Bug items found for the selected date range.</div>
          ) : (
            <>
              <div className="bug-aging-summary">
                <strong>{report.includedCount}</strong> bugs with a completed In Progress interval
                {issues.length > report.includedCount && (
                  <span> · {issues.length - report.includedCount} without an In Progress exit excluded</span>
                )}
              </div>

              <div className="bug-aging-table-wrapper">
                <table className="bug-aging-table">
                  <thead>
                    <tr>
                      <th className="bug-aging-priority-cell">Priority</th>
                      {report.days.map((day) => (
                        <th key={day}>{formatDay(day)}</th>
                      ))}
                      <th className="bug-aging-total-cell">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.priorities.map((priority) => {
                      const values = report.counts.get(priority) ?? [];

                      return (
                        <tr key={priority}>
                          <th className="bug-aging-priority-cell" scope="row">{priority}</th>
                          {values.map((count, index) => (
                            <td key={report.days[index]} className={count > 0 ? 'bug-aging-count-active' : ''}>{count}</td>
                          ))}
                          <td className="bug-aging-total-cell">{values.reduce((sum, count) => sum + count, 0)}</td>
                        </tr>
                      );
                    })}
                    <tr className="bug-aging-totals-row">
                      <th className="bug-aging-priority-cell" scope="row">Total</th>
                      {report.dayTotals.map((total, index) => (
                        <td key={report.days[index]}>{total}</td>
                      ))}
                      <td className="bug-aging-total-cell">
                        {report.dayTotals.reduce((sum, total) => sum + total, 0)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
