import { z } from 'zod';
import type { FunctionDeclaration } from '@google/genai';
import { AimHintSchema } from '@glance/shared';

/** The function that the model of a Live session calls to say what the stream shows. */
export const REPORT_VIEW = 'report_view';

/**
 * How a Live session gets its reports. Only `tick` gave reports in the measurement of 2026-11-14: see the README.
 * `change`: the client sends frames only, and the model reports when the view changes.
 * `pace`: the client sends frames only, and the model reports one time each second.
 * `tick`: the client sends the text "report", and the model answers each one.
 * `activity`: the client marks each frame as one activity of the user, and the model answers each one.
 */
export const LIVE_FORMS = ['change', 'pace', 'tick', 'activity'] as const;
export type LiveForm = typeof LIVE_FORMS[number];

const WHEN: Record<LiveForm, string> = {
  change: `Call \`${REPORT_VIEW}\` at once when the view changes: a hand holds a product up, the product turns, the product leaves, or you can now name it. Do not wait for a question.`,
  pace: `Call \`${REPORT_VIEW}\` one time each second for the newest frame, also when nothing changed. Do not wait for a question.`,
  tick: `The message "report" asks for one report. For each such message, call \`${REPORT_VIEW}\` one time for the newest frame.`,
  activity: `Each frame arrives as one turn of the user. For each turn, call \`${REPORT_VIEW}\` one time for the frame of that turn.`,
};

/**
 * The instruction of a Live session: the instruction of the per-frame call, and how the model reports in a stream.
 * The fields of the report have the meaning that the base instruction gives to the fields of the JSON answer.
 */
export function buildLiveInstruction(base: string, form: LiveForm): string {
  return [
    base,
    '',
    '## Live session',
    '',
    'In this session you get a stream of camera frames and no single frame. Judge the newest frame. The frames before it only help you to read a blurred package.',
    `Your only answer is a call of the function \`${REPORT_VIEW}\`. Never speak, and never write JSON as text.`,
    WHEN[form],
    'The arguments are the fields of the JSON answer above: `status`, `productId`, `candidates`, `confidence`, `aimHint`, and the code of the frame as `codeVisible` and `codeDigits`.',
  ].join('\n');
}

/**
 * The declaration of report_view. As in the schema of the per-frame answer, the product fields take only the given IDs.
 * The arguments are flat: the code of the frame is two arguments and no object.
 */
export function reportViewDeclaration(productIds: readonly string[]): FunctionDeclaration {
  const id = productIds.length > 0 ? z.enum(productIds as [string, ...string[]]) : null;
  return {
    name: REPORT_VIEW,
    description: 'Reports what the newest camera frame shows: the product that a hand holds up, or that no hand holds a product up.',
    parametersJsonSchema: z.toJSONSchema(z.object({
      status: z.enum(['identified', 'ambiguous', 'unsure', 'unknown', 'none']),
      productId: id === null ? z.null() : id.nullable(),
      candidates: (id === null ? z.array(z.string()).max(0) : z.array(id)).optional(),
      confidence: z.number().min(0).max(1),
      aimHint: AimHintSchema,
      codeVisible: z.boolean(),
      codeDigits: z.string().nullable(),
    })),
  };
}

/**
 * The arguments of a report_view call in the shape of the per-frame answer, for normalizeResult.
 * It checks nothing: normalizeResult does, and it gives "no product" for arguments that are no report.
 * The report has no gesture, and a call with no code fields has no code.
 * The report has no `held` field: the instruction of the session asks only about a product in a hand.
 */
export function resultFromReport(args: unknown): unknown {
  if (typeof args !== 'object' || args === null) return args;
  const { codeVisible, codeDigits, candidates, ...fields } = args as Record<string, unknown>;
  return {
    ...fields,
    held: true,
    candidates: candidates ?? [],
    gesture: 'none',
    code: { visible: codeVisible ?? false, digits: codeDigits ?? null },
  };
}
