// connpass のイベントタイトルを公式 API v2 で取得する。
//
// connpass はスクレイピングを規約で禁止しており（2024-09〜）、ページは AWS WAF の
// チャレンジ（202 + x-amzn-waf-action: challenge）を返すため HTML からは取れない。
// そのため connpass の URL は HTML を一切取りに行かず、API だけを使う。
//
// - API キーは環境変数 CONNPASS_API_KEY（無ければ API も呼ばず null を返す）
// - フリープランは 1 リクエスト/12 秒・100 リクエスト/日。超えると 429 → null
// - 仕様: https://connpass.com/about/api/v2/

const API_URL = "https://connpass.com/api/v2/events/";

/**
 * connpass のイベント URL ならイベント ID を返す。connpass の URL でなければ null。
 * 対象: https://connpass.com/event/364/ と https://<subdomain>.connpass.com/event/364/（末尾のパスは問わない）
 */
export function parseConnpassEventId(urlString: string): number | null {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host !== "connpass.com" && !host.endsWith(".connpass.com")) return null;

  const match = url.pathname.match(/^\/event\/(\d+)(?:\/|$)/);
  return match ? Number(match[1]) : null;
}

/** connpass のドメイン（サブドメイン含む）かどうか */
export function isConnpassUrl(urlString: string): boolean {
  try {
    const host = new URL(urlString).hostname.toLowerCase();
    return host === "connpass.com" || host.endsWith(".connpass.com");
  } catch {
    return false;
  }
}

/** API でタイトルを取得する。キー未設定・該当なし・429 などのエラー時は null */
export async function fetchConnpassTitle(eventId: number): Promise<string | null> {
  const apiKey = process.env.CONNPASS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(`${API_URL}?event_id=${eventId}&count=1`, {
      headers: { "X-API-Key": apiKey },
      signal: AbortSignal.timeout(5000),
      redirect: "error",
    });
    if (!res.ok) {
      // 401: キー不正 / 429: スロットリング。中身はログに出さない（キーを含めないため状態だけ）
      console.warn(`[connpass] API returned ${res.status} for event ${eventId}`);
      return null;
    }
    const data: unknown = await res.json();
    const events = (data as { events?: unknown }).events;
    if (!Array.isArray(events) || events.length === 0) return null;
    const title = (events[0] as { title?: unknown }).title;
    return typeof title === "string" && title.trim() ? title.trim() : null;
  } catch {
    return null;
  }
}
