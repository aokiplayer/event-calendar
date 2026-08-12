"use client";

import { useEffect, useRef, useState } from "react";
import type { Event, EventType, RelatedUrlType, RelatedUrlEntry } from "@/types/event";
import { EVENT_TYPE_ENTRIES, RELATED_URL_TYPE_LABELS } from "@/types/event";
import { dateInputToUTC, utcToDateInput, exclusiveToInclusiveDate } from "@/lib/date-utils";

type Props = {
  initialDates: { start: string; end: string } | null;
  event?: Event;
  onClose: () => void;
  onSaved: () => void;
};

const URL_TYPES = Object.entries(RELATED_URL_TYPE_LABELS) as [RelatedUrlType, string][];

// 認証は全員共有のため誰が投稿したか判別できない。名前は自由入力し、次回のためにブラウザへ記憶する
const POSTED_BY_KEY = "event-calendar.postedBy";

function readRememberedPostedBy(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(POSTED_BY_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberPostedBy(name: string) {
  try {
    if (name) localStorage.setItem(POSTED_BY_KEY, name);
    else localStorage.removeItem(POSTED_BY_KEY);
  } catch {
    // プライベートブラウジングなどで書き込めない場合は記憶を諦める（保存自体は成功している）
  }
}

export function EventFormModal({ initialDates, event, onClose, onSaved }: Props) {
  const isEditing = !!event;

  const [url, setUrl] = useState(event?.url ?? "");
  const [title, setTitle] = useState(event?.title ?? "");
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [startDate, setStartDate] = useState(
    event ? utcToDateInput(event.startDate) : (initialDates?.start ?? "")
  );
  const [endDate, setEndDate] = useState(
    event
      ? utcToDateInput(event.endDate)
      : initialDates?.end
      ? exclusiveToInclusiveDate(initialDates.end)
      : ""
  );
  const [type, setType] = useState<EventType>(event?.type ?? "ATTENDEE");
  const [description, setDescription] = useState(event?.description ?? "");
  // 編集時は記憶した名前を使わない（他人の投稿に自分の名前が入ってしまうため）
  const [postedBy, setPostedBy] = useState(() =>
    event ? (event.postedBy ?? "") : readRememberedPostedBy()
  );
  const [relatedUrls, setRelatedUrls] = useState<RelatedUrlEntry[]>(
    event?.relatedUrls.map((r) => ({ url: r.url, urlType: r.urlType })) ??
      [{ url: "", urlType: "REPORT" }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    urlInputRef.current?.focus();
  }, []);

  async function handleUrlBlur() {
    if (!url || title) return;
    setFetchingTitle(true);
    try {
      const res = await fetch(`/api/fetch-title?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.title) setTitle(data.title);
    } finally {
      setFetchingTitle(false);
    }
  }

  function updateRelatedUrl(i: number, patch: Partial<RelatedUrlEntry>) {
    const next = [...relatedUrls];
    next[i] = { ...next[i], ...patch };
    setRelatedUrls(next);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url || !title || !startDate || !endDate) return;
    setSaving(true);
    setError(null);
    const trimmedPostedBy = postedBy.trim();
    try {
      const payload = {
        url,
        title,
        startDate: dateInputToUTC(startDate),
        endDate: dateInputToUTC(endDate),
        type,
        description: description || null,
        postedBy: trimmedPostedBy || null,
        relatedUrls: relatedUrls.filter((r) => r.url),
      };
      const res = isEditing
        ? await fetch(`/api/events/${event.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      if (!res.ok) {
        setError("保存に失敗しました。もう一度お試しください。");
        return;
      }
      // 編集では記憶を更新しない（他人の投稿を直したときに自分の名前が上書きされるのを防ぐ）
      if (!isEditing) rememberPostedBy(trimmedPostedBy);
      onSaved();
    } catch {
      setError("通信エラーが発生しました。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">
            {isEditing ? "イベントを編集" : "イベントを登録"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              イベント URL <span className="text-red-500">*</span>
            </label>
            <input
              ref={urlInputRef}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={handleUrlBlur}
              placeholder="https://example.com/event"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タイトル <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={fetchingTitle ? "取得中..." : "イベントタイトル"}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              {fetchingTitle && (
                <span className="absolute right-3 top-2.5 text-xs text-gray-400">取得中...</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                開始日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                終了日 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">種別</label>
            <div className="flex gap-3">
              {EVENT_TYPE_ENTRIES.map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="type"
                    value={value}
                    checked={type === value}
                    onChange={() => setType(value)}
                    className="accent-blue-600"
                  />
                  {label}
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              「情報」は参加・登壇しないイベントの共有に使えます
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              投稿者名 <span className="text-xs text-gray-400">任意</span>
            </label>
            <input
              type="text"
              value={postedBy}
              onChange={(e) => setPostedBy(e.target.value)}
              maxLength={50}
              placeholder="例：青木"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="発表内容やメモなど"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">関連 URL</label>
            <div className="space-y-2">
              {relatedUrls.map((entry, i) => (
                <div key={i} className="flex gap-2">
                  <select
                    value={entry.urlType}
                    onChange={(e) => updateRelatedUrl(i, { urlType: e.target.value as RelatedUrlType })}
                    className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {URL_TYPES.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <input
                    type="url"
                    value={entry.url}
                    onChange={(e) => updateRelatedUrl(i, { url: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {relatedUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setRelatedUrls(relatedUrls.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500 transition-colors px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRelatedUrls([...relatedUrls, { url: "", urlType: "REPORT" }])}
                className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
              >
                + URL を追加
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? "保存中..." : isEditing ? "更新" : "登録"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

