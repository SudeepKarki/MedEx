import { z } from "zod";

/** The booking API's shapes, validated leniently: providers type this data by hand. */
const clock = z.string();

export const rawScheduleSchema = z.record(
  z.string(),
  z.object({ startTime: clock, endTime: clock }).nullable(),
);

export const rawSpecialistSchema = z.object({
  id: z.string(),
  name: z.string(),
  speciality: z.string().nullish(),
  consultation: z.object({
    startTime: clock,
    endTime: clock,
    durationInMinutes: z.number(),
    bufferInMinutes: z.number().nullish(),
  }),
});

export const rawProviderSchema = z.object({
  id: z.number(),
  name: z.string(),
  country: z.string().nullish(),
  timezone: z.string().nullish(),
  daySchedules: rawScheduleSchema.nullish(),
  specialists: z.array(z.unknown()).nullish(),
  /** Added by the mock API: closures as real dates. */
  closures: z.array(z.object({ date: z.string(), reason: z.string().nullish() })).nullish(),
});

export type RawProvider = z.infer<typeof rawProviderSchema>;
