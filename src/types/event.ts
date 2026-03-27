import { z } from "zod";
import { eventTypeSchema, relatedUrlTypeSchema, relatedUrlSchema } from "@/lib/validation";

// Zod スキーマから自動推論（validation.ts が単一ソース）
export type EventType = z.infer<typeof eventTypeSchema>;
export type RelatedUrlType = z.infer<typeof relatedUrlTypeSchema>;
export type RelatedUrlEntry = z.infer<typeof relatedUrlSchema>;

export const RELATED_URL_TYPE_LABELS: Record<RelatedUrlType, string> = {
  REPORT: "レポート",
  SLIDES: "登壇資料",
  VIDEO: "動画",
  OTHER: "その他",
};

// API レスポンス（DB レコード）の型 — id や timestamp を含むため手動定義
export type RelatedUrl = {
  id: string;
  url: string;
  urlType: RelatedUrlType;
  eventId: string;
  createdAt: string;
};

export type Event = {
  id: string;
  url: string;
  title: string;
  startDate: string;
  endDate: string;
  type: EventType;
  description: string | null;
  relatedUrls: RelatedUrl[];
  createdAt: string;
  updatedAt: string;
};
