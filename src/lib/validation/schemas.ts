import { z } from "zod";

export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD date keys.");

export const nonEmptyIdSchema = z.string().trim().min(1).max(160);

export const startTimerSchema = z
  .object({
    taskId: nonEmptyIdSchema.optional(),
    taskTitle: z.string().trim().min(1).max(160).optional(),
    description: z.string().trim().max(500).optional()
  })
  .refine((data) => data.taskId || data.taskTitle, {
    message: "Either taskId or taskTitle must be provided."
  });

export const stopTimerSchema = z.object({
  timeEntryId: nonEmptyIdSchema.optional()
});

export const timeEntryUpdateSchema = z.object({
  id: nonEmptyIdSchema.optional(),
  taskId: nonEmptyIdSchema,
  description: z.string().trim().max(500).optional(),
  dateKey: dateKeySchema,
  durationSeconds: z.number().int().positive().max(60 * 60 * 24),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional()
});

export const dateRangeSchema = z
  .object({
    start: dateKeySchema,
    end: dateKeySchema
  })
  .refine((range) => range.start <= range.end, {
    message: "Start date must be before or equal to end date."
  });

export const generateInvoiceSchema = z.object({
  clientName: z.string().trim().min(1).max(160),
  dateRange: dateRangeSchema,
  dueDate: dateKeySchema.optional().nullable(),
  timeEntryIds: z.array(nonEmptyIdSchema).min(1).max(200).optional()
});

export const invoiceStatusSchema = z.object({
  invoiceId: nonEmptyIdSchema
});

export const updateInvoiceLineItemsSchema = z.object({
  invoiceId: nonEmptyIdSchema,
  lineItems: z
    .array(
      z.object({
        timeEntryId: nonEmptyIdSchema,
        taskTitle: z.string().trim().min(1).max(160),
        durationSeconds: z.number().int().positive().max(60 * 60 * 24 * 7)
      })
    )
    .min(1)
    .max(200)
});

export const updateDefaultRateSchema = z.object({
  defaultHourlyRateCents: z.number().int().nonnegative().max(1_000_000)
});

export const taskUpsertSchema = z.object({
  id: nonEmptyIdSchema.optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional().nullable(),
  hourlyRateCentsOverride: z.number().int().nonnegative().max(1_000_000).optional().nullable(),
  status: z.enum(["active", "archived"]).default("active")
});
