import { SessionOptions } from "iron-session";

export const sessionOptions: SessionOptions = {
  cookieName: "event-calendar-session",
  password: process.env.SESSION_SECRET!,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
  },
};

export type SessionData = {
  isLoggedIn: boolean;
};
