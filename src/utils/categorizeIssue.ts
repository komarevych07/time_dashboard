import type { Category } from '../types/jira';

export function categorizeIssue(summary: string, issueType: string): Category {
  if (/\[FE\]/i.test(summary)) {
    return 'FE';
  }

  if (/\[BE\]/i.test(summary)) {
    return 'BE';
  }

  if (/\[QA\]/i.test(summary)) {
    return 'QA';
  }

  if (/\[AQA\]/i.test(summary)) {
    return 'AQA';
  }

  if (/\[Flight\]/i.test(summary)) {
    return 'FLIGHT';
  }

  if (/\[BA\]/i.test(summary)) {
    return 'BA';
  }

  if (/\[UX\]/i.test(summary)) {
    return 'UX';
  }

  if (issueType.toLowerCase() === 'epic') {
    return 'EPIC';
  }

  if (issueType.toLowerCase() === 'bug') {
    return 'BUGS';
  }

  return 'OTHER';
}
