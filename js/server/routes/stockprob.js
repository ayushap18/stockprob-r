import { z } from 'zod';

const outperformanceSchema = z.object({
  ticker: z
    .string()
    .trim()
    .min(1)
    .max(16)
    .regex(/^[A-Za-z0-9.^-]+$/, 'Ticker can only include letters, numbers, dot, caret, or hyphen')
    .transform((value) => value.toUpperCase()),
  horizon: z.coerce.number().int().refine((value) => [5, 10, 20].includes(value), 'horizon must be 5, 10, or 20'),
  as_of_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'as_of_date must be YYYY-MM-DD')
    .optional(),
  risk_tolerance: z.enum(['low', 'moderate', 'high']).default('moderate'),
});

export function parseOutperformancePayload(payload) {
  const result = outperformanceSchema.safeParse(payload);
  if (!result.success) {
    const error = new Error(result.error.issues.map((issue) => issue.message).join('; '));
    error.status = 400;
    throw error;
  }
  return { ...result.data, as_of_date: result.data.as_of_date };
}
