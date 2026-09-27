export const REVIEW_SOURCES = ["public", "manual", "google", "facebook"] as const;

export type ReviewSource = (typeof REVIEW_SOURCES)[number];

export type ReviewRow = {
  id: string;
  rating: number;
  comment: string;
  source: string;
  reviewerName: string;
  publicToken: string;
  createdAt: string;
  respondedAt: string | null;
  responseNote: string;
};

export type ReviewRequestRow = {
  id: string;
  channel: string;
  toAddress: string;
  status: string;
  publicToken: string;
  createdAt: string;
};

export type ReviewTemplateRow = {
  id: string;
  name: string;
  channel: string;
  subject: string;
  body: string;
};

export type ReviewDesk = {
  preview: boolean;
  notice: string | null;
  canManage: boolean;
  orgSlug: string;
  senderName: string;
  siteUrl: string;
  publicPath: string;
  consentText: string;
  defaultBody: string;
  average: number | null;
  count: number;
  ratingFilter: number | null;
  reviews: ReviewRow[];
  requests: ReviewRequestRow[];
  templates: ReviewTemplateRow[];
};

export type PublicReviewCard = {
  rating: number;
  comment: string;
  name: string;
  source: string;
  createdAt: string;
};

export type PublicReviewPage =
  | {
      kind: "form";
      preview: boolean;
      key: string;
      orgName: string;
      orgSlug: string;
      senderName: string;
      average: number | null;
      count: number;
      recent: PublicReviewCard[];
    }
  | {
      kind: "missing";
      preview: boolean;
      key: string;
      message: string;
    };

export type ReviewCatalog = {
  kind?: string;
  orgName?: string;
  orgSlug?: string;
  senderName?: string;
  average?: number | string | null;
  count?: number | string;
  recent?: Array<{
    rating?: number | string;
    comment?: string;
    name?: string;
    source?: string;
    createdAt?: string;
  }>;
};
