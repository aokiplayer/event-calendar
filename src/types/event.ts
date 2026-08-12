import { z } from "zod";
import { eventTypeSchema, relatedUrlTypeSchema, relatedUrlSchema } from "@/lib/validation";

// Zod スキーマから自動推論（validation.ts が単一ソース）
export type EventType = z.infer<typeof eventTypeSchema>;
export type RelatedUrlType = z.infer<typeof relatedUrlTypeSchema>;
export type RelatedUrlEntry = z.infer<typeof relatedUrlSchema>;

// 宣言順がそのまま UI の表示順（フォームのラジオ・カレンダーの凡例）になる
export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  INFO: "情報",
  ATTENDEE: "参加",
  SPEAKER: "登壇",
};

// 色は 16 進数で一元管理する（FullCalendar が hex を要求するため Tailwind クラスは併用しない）
export const EVENT_TYPE_COLORS: Record<EventType, { bg: string; border: string }> = {
  INFO: { bg: "#64748b", border: "#475569" },
  ATTENDEE: { bg: "#0d9488", border: "#0f766e" },
  SPEAKER: { bg: "#f97316", border: "#ea580c" },
};

export const EVENT_TYPE_ENTRIES = Object.entries(EVENT_TYPE_LABELS) as [EventType, string][];

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
  postedBy: string | null;
  relatedUrls: RelatedUrl[];
  createdAt: string;
  updatedAt: string;
};
