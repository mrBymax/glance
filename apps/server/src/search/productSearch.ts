import { normalizeGtin } from '@glance/shared';
import type { StoreEntry } from '../products/storeEntries';
import { sizeKey, wordMatch, wordsOf } from './normalize';

/** What a reader saw of a package: each field as printed, in each language. A plain text counts as the name. */
export type SearchQuery = {
  brand?: string | null;
  name?: string | null;
  variant?: string | null;
  size?: string | null;
  /** Other words of the package. They count half, and a word that no item has does not count against an item. */
  texts?: readonly string[];
  /** Digit runs near a barcode. */
  digits?: readonly string[];
};

export type Candidate = {
  /** 13 digits. */
  gtin: string;
  /** 0 to 1: the share of the read words that this item explains, each word by how few items have it. */
  score: number;
  /** The fields that matched, with the words of the item: "brand: kili", "name: cascara, vadelma", "size: 330ml", "code: ...". */
  reasons: string[];
  /** What `pickOne` needs: a brand word matched, a word that is no brand word matched, and the sizes differ. */
  matched: { code: boolean; brand: boolean; name: boolean; sizeConflict: boolean };
};

/**
 * Finds the store items that fit what a reader saw of a package. It uses no model: the same query gives the same answer.
 * The file index below is for a demo store. A database or the ERP of a supermarket can stand behind the same two
 * methods: `search` with a plain text is a text search of that system. A call that fails rejects.
 */
export interface ProductSearch {
  /** The candidates, best first, at most `limit`. An empty list when no item fits. */
  search(query: SearchQuery | string, limit: number): Promise<Candidate[]>;
  /** The item of a code of 13 digits, with the details of the product database. */
  get(gtin13: string): Promise<StoreEntry | undefined>;
}

/** The share of a size in a score, against words with a weight of up to 1 each. */
const SIZE_WEIGHT = 0.3;
/** A word of the field `texts` counts this much of a word of the brand or the name. */
const TEXT_WEIGHT = 0.5;
/** `pickOne` takes a candidate from this score on, and with this lead over the second one. */
export const PICK_MIN_SCORE = 0.6;
export const PICK_MIN_LEAD = 0.1;

type Indexed = { entry: StoreEntry; brand: Set<string>; other: Set<string>; size: string | null };

/** "n" and "al" tell no product apart, and a model misreads them. A number always counts: "n.5" is not "n.12". */
const counts = (word: string): boolean => word.length >= 3 || /\d/.test(word);

/**
 * The index of a store list in memory, built one time. Each item gives the words of its name, its brand, and its pack
 * size from the store list, and the names in each language, the brands, and the keywords from the product database.
 * A word weighs by how few items have it: the brand that three items share selects none of them, and the flavor
 * word of one item selects it.
 */
export function createProductSearch(entries: readonly StoreEntry[]): ProductSearch & {
  /** Takes a new item, or a newer entry of an item: the product database gave its texts after the start. */
  put(entry: StoreEntry): void;
  /** Takes an item out. The weight of each word then counts the items that are left. */
  remove(gtin13: string): void;
} {
  const indexed = (entry: StoreEntry): Indexed => {
    const { item, details } = entry;
    const brand = new Set([item.brand ?? '', details?.brand ?? '', ...(details?.texts?.brands ?? [])].flatMap(wordsOf).filter(counts));
    const other = new Set([item.name, ...(details?.texts?.names ?? []), ...(details?.texts?.keywords ?? [])].flatMap(wordsOf).filter(counts));
    for (const word of brand) other.delete(word);
    const size = sizeKey(item.packSize ?? details?.quantity ?? '');
    return { entry, brand, other, size };
  };
  /** In the order of the store list. A Map keeps the place of an item that gets a newer entry. */
  const byGtin = new Map(entries.map((entry) => [entry.item.gtin, indexed(entry)]));
  let items: Indexed[] = [];
  const itemsWith = new Map<string, number>();
  const count = (): void => {
    items = [...byGtin.values()];
    itemsWith.clear();
    for (const { brand, other } of items) {
      for (const word of new Set([...brand, ...other])) itemsWith.set(word, (itemsWith.get(word) ?? 0) + 1);
    }
  };
  count();
  /** From 0 to 1. A word of one item weighs 1, and a word of each item weighs least. */
  const weight = (word: string): number => Math.log(1 + items.length / (itemsWith.get(word) ?? 1)) / Math.log(1 + items.length);

  /** The best word of the item for a read word, or null. */
  const best = (read: string, item: Indexed): { word: string; match: number; brand: boolean } | null => {
    let found: { word: string; match: number; brand: boolean } | null = null;
    for (const [words, brand] of [[item.brand, true], [item.other, false]] as const) {
      for (const word of words) {
        const match = wordMatch(read, word);
        if (match > 0 && (found === null || match * weight(word) > found.match * weight(found.word))) found = { word, match, brand };
      }
    }
    return found;
  };

  const byCode = (digits: readonly string[]): Candidate[] | null => {
    const codes = new Set(digits.flatMap((run) => normalizeGtin(run.replace(/\s/g, '')) ?? []).filter((gtin) => byGtin.has(gtin)));
    if (codes.size === 0) return null;
    // Two codes of two items: the frame shows two products, or the reader made a digit up.
    if (codes.size > 1) return [];
    const [gtin] = codes;
    return [{ gtin: gtin!, score: 1, reasons: [`code: ${gtin}`], matched: { code: true, brand: false, name: false, sizeConflict: false } }];
  };

  const rank = (query: SearchQuery, limit: number): Candidate[] => {
    const coded = byCode(query.digits ?? []);
    if (coded !== null) return coded;

    const fields = [
      { label: 'brand', share: 1, words: wordsOf(query.brand ?? '') },
      { label: 'name', share: 1, words: wordsOf(`${query.name ?? ''} ${query.variant ?? ''}`) },
      { label: 'text', share: TEXT_WEIGHT, words: (query.texts ?? []).flatMap(wordsOf) },
    ].map((field) => ({ ...field, words: [...new Set(field.words.filter(counts))] }));
    const size = sizeKey(query.size ?? '');

    // What a word of the brand or the name weighs when the item does not have it: the weight of the best word
    // that an item has for it. A word that no item has is the word of another product, so it weighs 1.
    const lost = (read: string): number => {
      let most = 0;
      for (const item of items) {
        const found = best(read, item);
        if (found) most = Math.max(most, weight(found.word));
      }
      return most === 0 ? 1 : most;
    };

    const candidates = items.flatMap((item): Candidate[] => {
      let got = 0;
      let all = 0;
      const matched = { code: false, brand: false, name: false, sizeConflict: false };
      const reasons: string[] = [];
      for (const { label, share, words } of fields) {
        const hits: string[] = [];
        for (const read of words) {
          const found = best(read, item);
          if (found) {
            got += share * found.match * weight(found.word);
            all += share * weight(found.word);
            hits.push(found.word);
            if (found.brand) matched.brand = true;
            else matched.name = true;
          } else if (label !== 'text') {
            all += lost(read);
          }
        }
        if (hits.length > 0) reasons.push(`${label}: ${[...new Set(hits)].join(', ')}`);
      }
      if (got === 0) return [];
      if (size !== null && item.size !== null) {
        all += SIZE_WEIGHT;
        if (size === item.size) {
          got += SIZE_WEIGHT;
          reasons.push(`size: ${size}`);
        } else {
          matched.sizeConflict = true;
        }
      }
      return [{ gtin: item.entry.item.gtin, score: Math.round((got / all) * 1000) / 1000, reasons, matched }];
    });
    // Array.sort is stable, so items with one score keep the order of the store list.
    return candidates.sort((a, b) => b.score - a.score).slice(0, limit);
  };

  return {
    search: async (query, limit) => rank(typeof query === 'string' ? { name: query } : query, limit),
    get: async (gtin13) => byGtin.get(gtin13)?.entry,
    put: (entry) => {
      byGtin.set(entry.item.gtin, indexed(entry));
      count();
    },
    remove: (gtin13) => {
      if (byGtin.delete(gtin13)) count();
    },
  };
}

/**
 * The one candidate that the read words select, or null. A code selects its item. Else the first candidate needs
 * a word of its brand and a word of its own, a score of PICK_MIN_SCORE, no other size than the read one, and a lead of
 * PICK_MIN_LEAD over the second candidate. So "Kili" selects none of three flavors, "Vadelma" alone selects no brand,
 * and "Kili" with "Vadelma" selects one item. `candidates` is a result of `search`, best first.
 */
export function pickOne(candidates: readonly Candidate[]): Candidate | null {
  const [first, second] = candidates;
  if (!first) return null;
  if (first.matched.code) return first;
  if (!first.matched.brand || !first.matched.name || first.matched.sizeConflict || first.score < PICK_MIN_SCORE) return null;
  return second === undefined || first.score - second.score >= PICK_MIN_LEAD ? first : null;
}
