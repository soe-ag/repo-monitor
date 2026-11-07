import { z } from 'zod'
import { PACKAGE_POLICIES } from '@/convex/constants'

export const MAX_SELECTED_REPOSITORIES = 10

const packagePolicySchema = z.enum(PACKAGE_POLICIES, {
  error: 'packagePolicy must be one of: any-newer, minor-or-major, major-only',
})

export const connectBodySchema = z.object({
  pat: z.string({ error: 'PAT is required' }).trim().min(1, 'PAT is required'),
  packagePolicy: packagePolicySchema.optional(),
})

export const packagePolicyBodySchema = z.object({
  packagePolicy: packagePolicySchema,
})

export const scanBodySchema = z.discriminatedUnion(
  'mode',
  [
    z.object({
      mode: z.literal('single'),
      repositoryId: z
        .string({ error: 'Single scan requires a repositoryId.' })
        .min(1, 'Single scan requires a repositoryId.'),
      repositoryIds: z
        .array(z.string())
        .max(0, 'Single scan must not include repositoryIds. Use mode=all for selected scans.')
        .optional(),
    }),
    z.object({
      mode: z.literal('all'),
      repositoryId: z
        .unknown()
        .optional()
        .refine((value) => !value, {
          error: 'Selected scan must use repositoryIds only. Use mode=single for one repository.',
        }),
      repositoryIds: z
        .array(z.string().min(1), { error: 'Select repositories to scan (max 10).' })
        .min(1, 'Select repositories to scan (max 10).')
        .max(MAX_SELECTED_REPOSITORIES, 'Select repositories to scan (max 10).'),
    }),
  ],
  { error: 'Invalid scan mode. Use mode="single" or mode="all".' }
)

export type ScanBody = z.infer<typeof scanBodySchema>
