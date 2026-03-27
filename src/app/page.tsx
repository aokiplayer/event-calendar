"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateSelectArg, EventClickArg } from "@fullcalendar/core";
import { EventFormModal } from "@/components/EventFormModal";
import { EventDetailModal } from "@/components/EventDetailModal";
import type { Event } from "@/types/event";
import { inclusiveToExclusiveDate } from "@/lib/date-utils";
import { useRouter } from "next/navigation";

export default function CalendarPage() {
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<{ start: string; end: string } | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/events");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEvents(data);
      setFetchError(false);
    } catch {
      setFetchError(true);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const calendarEvents = events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.startDate,
    end: inclusiveToExclusiveDate(e.endDate),
    allDay: true,
    backgroundColor: e.type === "SPEAKER" ? "#f97316" : "#0d9488",
    borderColor: e.type === "SPEAKER" ? "#ea580c" : "#0f766e",
  }));

  const handleDateSelect = (arg: DateSelectArg) => {
    setSelectedDates({ start: arg.startStr, end: arg.endStr });
    setFormOpen(true);
  };

  const handleEventClick = (arg: EventClickArg) => {
    const event = events.find((e) => e.id === arg.event.id);
    if (event) setSelectedEvent(event);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">参加・登壇・気になるイベント情報</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setSelectedDates(null);
              setFormOpen(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + イベント登録
          </button>
          <button
            onClick={async () => {
              await fetch("/api/auth", { method: "DELETE" });
              router.push("/login");
            }}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ログアウト
          </button>
        </div>
      </header>

      <main className="p-6">
        {fetchError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
            <span>イベントの取得に失敗しました。</span>
            <button onClick={fetchEvents} className="underline hover:no-underline ml-4">
              再試行
            </button>
          </div>
        )}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-orange-500 inline-block" />
              登壇
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-teal-600 inline-block" />
              参加
            </span>
          </div>
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale="ja"
            selectable
            select={handleDateSelect}
            events={calendarEvents}
            eventClick={handleEventClick}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "",
            }}
            height="auto"
            buttonText={{ today: "今日" }}
          />
        </div>
      </main>

      {formOpen && (
        <EventFormModal
          initialDates={selectedDates}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            fetchEvents();
          }}
        />
      )}

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDeleted={() => {
            setSelectedEvent(null);
            fetchEvents();
          }}
          onUpdated={() => {
            setSelectedEvent(null);
            fetchEvents();
          }}
        />
      )}
    </div>
  );
}

