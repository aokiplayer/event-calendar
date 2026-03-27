import { z } from "zod";

export const eventTypeSchema = z.enum(["SPEAKER", "ATTENDEE"]);

export const relatedUrlTypeSchema = z.enum(["REPORT", "SLIDES", "VIDEO", "OTHER"]);

export const relatedUrlSchema = z.object({
  url: z.string().url(),
  urlType: relatedUrlTypeSchema,
});

export const eventSchema = z.object({
  url: z.string().url(),
  title: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  type: eventTypeSchema,
  description: z.string().nullable().optional(),
  relatedUrls: z.array(relatedUrlSchema).optional().default([]),
});
