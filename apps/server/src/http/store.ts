import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { type Allergen, type Product, normalizeGtin } from '@glance/shared';
import type { LiveStore } from '../products/liveStore';
import type { ProductInfo } from '../products/productInfo';
import type { StoreItem, StoreListReader } from '../products/storeList';
import { type ReferenceImage, type ReferenceImages, REFERENCES_FOR_ITEM } from '../reference/images';

/** One store item as the paths below give it. `pictures` is the number of its reference pictures. */
export type StoreItemView = {
  gtin: string; name: string; brand: string | null; packSize: string | null; priceCents: number; pictures: number;
};
export type StoreItemsResponse = { items: StoreItemView[] };
/** One reference picture. `name` is the last part of the path that gives its JPEG. `addedAt` is a clock value in milliseconds. */
export type StorePicture = { name: string; bytes: number; addedAt: number };
/** What Open Food Facts has for a code. `names` holds the product name and the generic name in each language that it has. */
export type ProductSuggestion = {
  names: string[]; brand: string | null; packSize: string | null;
  allergens: Allergen[] | null; vegan: boolean | null; vegetarian: boolean | null;
};
/** The answer of GET /api/store/items/:gtin. */
export type StoreItemResponse = {
  /** 13 digits. */
  gtin: string;
  /** null: the store does not have the code. */
  item: StoreItemView | null;
  /** Newest first. */
  pictures: StorePicture[];
  /** A recognition call uses at most this number of pictures of one item: the newest ones. */
  picturesUsed: number;
  /** `failed`: the read of Open Food Facts failed or was late. `not_found` also for a code of one store. */
  productInfo: 'found' | 'not_found' | 'failed';
  suggestion: ProductSuggestion | null;
  /** The price of the catalog product with this code, or null. A barcode gives that price, not the price of the store list. */
  catalogPriceCents: number | null;
};
export type StorePicturesResponse = { gtin: string; pictures: StorePicture[] };
export type StoreItemRemovedResponse = { gtin: string; removed: boolean; pictures: number };

/** The body of a picture has at most this size. The app sends a JPEG with a long side of 1600 pixels, which is below 1 MB. */
export const MAX_PICTURE_BYTES = 4 * 1024 * 1024;
/** One item holds at most this number of pictures, so a client cannot fill the disk through one code. */
export const MAX_PICTURES_FOR_ITEM = 12;

const CODE = /^(\d{8}|\d{12}|\d{13})$/;
const hasControl = (value: string): boolean => [...value].some((char) => char < ' ' || char === '\u007f');

/**
 * A text of the form: no space at its ends, one space between two words, and no control character.
 * Each item is one line of a model instruction, so its texts must not hold a line end.
 */
const text = (max: number) => z.string()
  .transform((value) => value.trim().replace(/\s+/g, ' '))
  .pipe(z.string().max(max).refine((value) => !hasControl(value)));

const ItemBodySchema = z.strictObject({
  name: text(80).pipe(z.string().min(1)),
  priceCents: z.number().int().min(1).max(999_999),
  brand: text(80).nullish(),
  packSize: text(40).nullish(),
});

const isJpeg = (body: Uint8Array): boolean => body.length > 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff;

/**
 * The paths that add, change, and remove store items and their reference pictures, for the debug menu of the phone app.
 * They take no key: each client that reaches the server can change the store list. STORE_EDIT=0 turns them off,
 * and app.ts then does not call this function, so each path answers 404.
 *
 * GET    /api/store/items                         each item
 * GET    /api/store/items/:gtin                   one item, its pictures, and what Open Food Facts has for the code
 * PUT    /api/store/items/:gtin                   adds or replaces the item: { name, priceCents, brand?, packSize? }
 * DELETE /api/store/items/:gtin                   removes the item and its pictures
 * GET    /api/store/items/:gtin/pictures          the pictures of the item
 * POST   /api/store/items/:gtin/pictures          adds one picture: a JPEG body of at most 4 MB
 * GET    /api/store/items/:gtin/pictures/:name    one picture as image/jpeg
 * DELETE /api/store/items/:gtin/pictures/:name    removes one picture
 *
 * A code has 8, 12, or 13 digits. A wrong length or check digit answers 400 with `bad_gtin`.
 */
export function registerStoreRoutes(app: FastifyInstance, deps: {
  live: LiveStore; storeList: StoreListReader; productInfo: Pick<ProductInfo, 'byGtin'>; references: ReferenceImages;
  /** The catalog products. A product with the code of an item wins over the item. */
  products: readonly Product[];
}): void {
  const catalogPrice = new Map(deps.products.flatMap((product) => {
    const gtin = product.gtin === undefined ? null : normalizeGtin(product.gtin);
    return gtin === null ? [] : [[gtin, product.priceCents] as const];
  }));

  /** 13 digits. For a bad code it sends the answer and returns null. */
  const gtinOf = (request: FastifyRequest, reply: FastifyReply): string | null => {
    const { gtin: code } = request.params as { gtin: string };
    const gtin = CODE.test(code) ? normalizeGtin(code) : null;
    if (gtin === null) void reply.code(400).send({ error: 'bad_gtin' });
    return gtin;
  };
  const view = (item: StoreItem, pictures: number): StoreItemView => ({
    gtin: item.gtin, name: item.name, brand: item.brand ?? null, packSize: item.packSize ?? null, priceCents: item.priceCents, pictures,
  });
  const picture = ({ file, bytes, addedAt }: ReferenceImage): StorePicture => ({ name: file, bytes, addedAt });
  const picturesOf = async (gtin: string): Promise<StorePicture[]> => (await deps.references.list(gtin)).map(picture);

  app.get('/api/store/items', async () => {
    const pictures = await deps.references.all();
    const answer: StoreItemsResponse = {
      items: (await deps.storeList.all()).map((item) => view(item, pictures.get(item.gtin)?.length ?? 0)),
    };
    return answer;
  });

  app.get('/api/store/items/:gtin', async (request, reply) => {
    const gtin = gtinOf(request, reply);
    if (gtin === null) return reply;
    const [item, pictures] = await Promise.all([deps.storeList.byGtin(gtin), picturesOf(gtin)]);
    // The reader has the cache, the time limit, and the pauses of each read of Open Food Facts.
    const details = await deps.productInfo.byGtin(gtin).catch((error: unknown) => {
      app.log.warn(`product info: no suggestion. gtin=${gtin} ${error instanceof Error ? error.message : String(error)}`);
      return 'failed' as const;
    });
    const answer: StoreItemResponse = {
      gtin,
      item: item ? view(item, pictures.length) : null,
      pictures,
      picturesUsed: REFERENCES_FOR_ITEM,
      productInfo: details === 'failed' ? 'failed' : details === null ? 'not_found' : 'found',
      suggestion: details === 'failed' || details === null ? null : {
        names: details.texts?.names ?? [], brand: details.brand, packSize: details.quantity,
        allergens: details.allergens, vegan: details.vegan, vegetarian: details.vegetarian,
      },
      catalogPriceCents: catalogPrice.get(gtin) ?? null,
    };
    return answer;
  });

  app.put('/api/store/items/:gtin', async (request, reply) => {
    const gtin = gtinOf(request, reply);
    if (gtin === null) return reply;
    const body = ItemBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: 'bad_request', fields: [...new Set(body.error.issues.map((issue) => String(issue.path[0] ?? 'body')))] });
    }
    const { name, priceCents, brand, packSize } = body.data;
    const isNew = await deps.storeList.byGtin(gtin) === undefined;
    const { item } = await deps.live.put({ gtin, priceCents, name, ...(brand ? { brand } : {}), ...(packSize ? { packSize } : {}) });
    app.log.info(`store item ${isNew ? 'added' : 'replaced'}. gtin=${gtin} priceCents=${priceCents}`);
    return reply.code(isNew ? 201 : 200).send(view(item, (await deps.references.list(gtin)).length));
  });

  app.delete('/api/store/items/:gtin', async (request, reply) => {
    const gtin = gtinOf(request, reply);
    if (gtin === null) return reply;
    const removed = await deps.live.remove(gtin);
    const answer: StoreItemRemovedResponse = { gtin, removed, pictures: await deps.references.remove(gtin) };
    if (removed) app.log.info(`store item removed. gtin=${gtin} pictures=${answer.pictures}`);
    return answer;
  });

  app.get('/api/store/items/:gtin/pictures', async (request, reply) => {
    const gtin = gtinOf(request, reply);
    if (gtin === null) return reply;
    const answer: StorePicturesResponse = { gtin, pictures: await picturesOf(gtin) };
    return answer;
  });

  app.post('/api/store/items/:gtin/pictures', { bodyLimit: MAX_PICTURE_BYTES }, async (request, reply) => {
    const gtin = gtinOf(request, reply);
    if (gtin === null) return reply;
    const { body } = request;
    if (!Buffer.isBuffer(body)) return reply.code(415).send({ error: 'unsupported_media_type' });
    if (!isJpeg(body)) return reply.code(400).send({ error: 'not_jpeg' });
    if (await deps.storeList.byGtin(gtin) === undefined) return reply.code(409).send({ error: 'no_item' });
    if ((await deps.references.list(gtin)).length >= MAX_PICTURES_FOR_ITEM) return reply.code(409).send({ error: 'too_many_pictures' });
    const added = await deps.references.add(gtin, new Uint8Array(body));
    app.log.info(`reference picture saved. gtin=${gtin} file=${added.file} bytes=${added.bytes} source=store`);
    const answer: StorePicturesResponse = { gtin, pictures: await picturesOf(gtin) };
    return reply.code(201).send(answer);
  });

  /** The picture of the item with this name, or null. The name must be one of the list, so it cannot hold a path. */
  const pictureOf = async (gtin: string, request: FastifyRequest): Promise<ReferenceImage | null> => {
    const { name } = request.params as { name: string };
    return (await deps.references.list(gtin)).find((image) => image.file === name) ?? null;
  };

  app.get('/api/store/items/:gtin/pictures/:name', async (request, reply) => {
    const gtin = gtinOf(request, reply);
    if (gtin === null) return reply;
    const image = await pictureOf(gtin, request);
    if (image === null) return reply.code(404).send({ error: 'not_found' });
    return reply.header('content-type', 'image/jpeg').send(Buffer.from(await deps.references.read(image)));
  });

  app.delete('/api/store/items/:gtin/pictures/:name', async (request, reply) => {
    const gtin = gtinOf(request, reply);
    if (gtin === null) return reply;
    const image = await pictureOf(gtin, request);
    if (image === null) return reply.code(404).send({ error: 'not_found' });
    await deps.references.removeOne(gtin, image.file);
    const answer: StorePicturesResponse = { gtin, pictures: await picturesOf(gtin) };
    return answer;
  });
}
