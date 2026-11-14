import numbersJson from './numbers.json';

export type Measured = { id: string; label: string; value: number | null; unit: string; note: string };
export type Numbers = { context: string | null; items: Measured[] };

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input);
const isText = (input: unknown): input is string => typeof input === 'string' && input.trim() !== '';

function parseItem(input: unknown, index: number): Measured {
  if (!isRecord(input) || !isText(input.id)) throw new Error(`numbers: item ${index} needs the key "id"`);
  const { id, label, value, unit, note } = input;
  if (!isText(label)) throw new Error(`numbers: item ${id} needs the key "label"`);
  if (!isText(unit)) throw new Error(`numbers: item ${id} needs the key "unit"`);
  if (typeof note !== 'string') throw new Error(`numbers: item ${id} needs the key "note"`);
  if (value !== null && !(typeof value === 'number' && Number.isFinite(value))) {
    throw new Error(`numbers: the value of item ${id} must be null or a finite number`);
  }
  return { id, label, value, unit, note };
}

// Throws an Error that names the item ID or the key.
export function parseNumbers(input: unknown): Numbers {
  if (!isRecord(input)) throw new Error('numbers: the file must hold one object');
  if (!Array.isArray(input.items) || input.items.length === 0) throw new Error('numbers: the key "items" needs one item or more');
  const items = input.items.map(parseItem);
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) throw new Error(`numbers: two items have the ID ${id}`);
    seen.add(id);
  }
  const { context } = input;
  if (context !== null && !isText(context)) throw new Error('numbers: the key "context" must be null or a sentence');
  // A number with no test conditions reads as a claim, so the page must not show one.
  if (context === null && items.some((item) => item.value !== null)) {
    throw new Error('numbers: a measured value needs the test conditions in the key "context"');
  }
  return { context, items };
}

export function formatMeasured(item: Measured): string {
  return item.value === null ? 'Not measured yet' : `${item.value} ${item.unit}`;
}

export const NUMBERS: Numbers = parseNumbers(numbersJson);
