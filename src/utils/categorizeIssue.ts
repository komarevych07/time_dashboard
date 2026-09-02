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

  if (issueType.toLowerCase() === 'bug') {
    return 'BUGS';
  }

  return 'OTHER';
}
