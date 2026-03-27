"use client";

import { useState } from "react";
import type { Event } from "@/types/event";
import { RELATED_URL_TYPE_LABELS } from "@/types/event";
import { EventFormModal } from "@/components/EventFormModal";

type Props = {
  event: Event;
  onClose: () => void;
  onDeleted: () => void;
  onUpdated: () => void;
};

function safeHref(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

export function EventDetailModal({ event, onClose, onDeleted, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(false);
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted();
    } catch {
      setDeleteError(true);
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  const start = new Date(event.startDate).toLocaleDateString("ja-JP");
  const end = new Date(event.endDate).toLocaleDateString("ja-JP");
  const isSingleDay = start === end;

  if (editing) {
    return (
      <EventFormModal
        initialDates={null}
        event={event}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onUpdated();
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <span
            className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
              event.type === "SPEAKER"
                ? "bg-orange-100 text-orange-700"
                : "bg-teal-100 text-teal-700"
            }`}
          >
            {event.type === "SPEAKER" ? "登壇" : "参加"}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 leading-snug">{event.title}</h2>
            {safeHref(event.url) ? (
              <a
                href={safeHref(event.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline break-all"
              >
                {event.url}
              </a>
            ) : (
              <span className="text-sm text-gray-400 break-all">{event.url}</span>
            )}
          </div>

          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-700">開催日：</span>
            {isSingleDay ? start : `${start} 〜 ${end}`}
          </div>

          {event.description && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">説明</p>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {event.relatedUrls.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">関連 URL</p>
              <ul className="space-y-1.5">
                {event.relatedUrls.map((r) => (
                  <li key={r.id} className="flex items-start gap-2">
                    <span className="shrink-0 text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 mt-0.5">
                      {RELATED_URL_TYPE_LABELS[r.urlType]}
                    </span>
                    {safeHref(r.url) ? (
                      <a
                        href={safeHref(r.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline break-all"
                      >
                        {r.url}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400 break-all">{r.url}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {deleteError && (
          <p className="mx-6 mb-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            削除に失敗しました。もう一度お試しください。
          </p>
        )}

        {confirmingDelete ? (
          <div className="px-6 py-4 border-t border-gray-200 bg-red-50 rounded-b-2xl">
            <p className="text-sm text-red-700 font-medium mb-3">このイベントを削除しますか？この操作は取り消せません。</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                disabled={deleting}
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? "削除中..." : "削除する"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-center px-6 py-4 border-t border-gray-200">
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-sm text-red-500 hover:text-red-700 transition-colors"
            >
              削除
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                編集
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
