import type { Binding, Draft, ReviewItem } from './patch.ts';

export type Fact = { id: string; label: string; value: string };

export type Review = {
  id: string;
  factId: string;
  replacement: string;
  items: ReviewItem[];
};

export type OperationStatus =
  | 'checking' | 'applying' | 'verified' | 'needs-review' | 'failed' | 'unknown' | 'not-attempted';

export type OperationItem = {
  draftId: string;
  channel: string;
  status: OperationStatus;
  message?: string;
  at?: string;
  edits?: ReviewItem['edits'];
};

export type Operation = { id: string; items: OperationItem[]; active?: boolean };

export type Workspace = {
  mode: 'sample' | 'buffer';
  configured: boolean;
  connection?: {
    organizations: { id: string; name: string }[];
    organizationId?: string;
  };
  available?: Draft[];
  availableFetchedAt?: string;
  nextCursor?: string;
  drafts: Draft[];
  facts: Fact[];
  bindings: Binding[];
  review?: Review;
  operation?: Operation;
  unresolved?: OperationItem[];
  notice?: string;
};
