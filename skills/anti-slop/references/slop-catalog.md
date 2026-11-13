# Slop Catalog: Before / After

## 1. Narration comments

Before:
```js
// Import the required dependencies
import { db } from "./db";

// Function to get active users
async function getActiveUsers() {
  // Query the database for active users
  const users = await db.user.findMany({ where: { active: true } });
  // Return the users
  return users;
}
```

After:
```js
import { db } from "./db";

async function getActiveUsers() {
  return db.user.findMany({ where: { active: true } });
}
```

## 2. A comment that earns its place

```go
// Stripe delivers webhooks out of order under load.
// Apply by event.Created, not arrival time. See incident #482.
if event.Created.Before(sub.LastEventAt) {
    return nil // stale event, already superseded
}
```

WHY + external quirk + incident link. This is what comments are for.

## 3. Error theater

Before:
```ts
try {
  await saveOrder(order);
} catch (error) {
  console.log("Error saving order:", error);
}
await sendConfirmationEmail(order); // runs even when the save failed
```

After:
```ts
await saveOrder(order); // error middleware logs once and maps to a 500
await sendConfirmationEmail(order);
```

Catch only where you can recover meaningfully or must translate the error; otherwise let it propagate to the boundary that logs once. `catch (e) { throw e; }` is pure noise - delete the block.

## 4. Fallbacks that hide bugs

Before (schema guarantees `items` and `price`):
```ts
const total = order?.items?.reduce((s, i) => s + (i?.price ?? 0), 0) ?? 0;
```

After:
```ts
const total = order.items.reduce((s, i) => s + i.price, 0);
```

If `items` can genuinely be absent, that's a state - handle it explicitly and visibly. Don't render $0 over corrupt data.

## 5. Single-implementation abstraction

Before: `IUserService` + `UserServiceImpl` + `UserServiceFactory` - one implementation, one caller.

After: plain functions or one class. Introduce the interface when a second real implementation exists. (Test doubles usually don't count: most can be produced without the indirection.)

## 6. Unrequested backwards compatibility

Before (brand-new file, first version ever):
```py
def process_payment_v2(payment): ...

def process_payment(payment):
    """Deprecated: use process_payment_v2."""
    return process_payment_v2(payment)
```

After: one function with the right name. There is no v1. Nobody asked for a shim.

## 7. Placeholder theater

Before:
```py
def send_sms(phone, msg):
    # In a real application, you would integrate an SMS provider here
    print(f"SMS to {phone}: {msg}")  # silently "succeeds"
```

After:
```py
def send_sms(phone, msg):
    raise NotImplementedError("SMS provider not configured")
```

Stubs fail loudly or don't exist. A stub that pretends to succeed produces bugs that surface far from their cause.

## 8. Redundant state

Before:
```ts
const [isLoading, setIsLoading] = useState(false);
const [isError, setIsError] = useState(false);
const [isSuccess, setIsSuccess] = useState(false);
// 8 combinations, 5 of them impossible
```

After:
```ts
const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
```

Derive booleans if call sites want them. Same principle for storing `fullName` next to `firstName`/`lastName`: compute, don't sync.

## 9. Reimplementing the platform

Before: hand-rolled `isEmptyObject`, string-built `formatDate`, custom `deepClone`, a bespoke retry loop.

After: `Object.keys(x).length === 0`; `Intl.DateTimeFormat` or the date lib already in package.json; `structuredClone`; the retry helper the project already has. Search the project and the stdlib before writing a utility.

## 10. Commit messages

Before: `🎉 feat: Add comprehensive user management system with robust error handling and seamless integration ✨`

After: `feat(users): add role checks to admin endpoints` - with a body explaining the authorization model and the migration required.

## 11. README for a small internal tool

Before: 300 lines for 200 lines of code - badge wall, emoji headings, "Features 🚀", table of contents, Contributing, License.

After (~25 lines): what it does in one sentence, requirements, run commands, env var table, known gotchas. The gotchas section is the only part with real value - it's the part only the author could write.

## 12. Test slop

Before:
```ts
it("should work", async () => {
  const svc = { getUser: jest.fn().mockResolvedValue({ id: 1 }) };
  const result = await svc.getUser(1);
  expect(result).toBeDefined(); // asserts the mock returns the mock
});
```

After:
```ts
it("returns 404 when the user belongs to another org", async () => {
  const res = await request(app)
    .get(`/users/${otherOrgUser.id}`)
    .set(authHeader(orgA));
  expect(res.status).toBe(404);
});
```

Real subject, real boundary, an assertion that fails when the behavior breaks.

## 13. Log and CLI output

Before:
```
🚀 Server started successfully on port 8080! ✅
✨ Database connection established! ✨
```

After:
```
listening on :8080
db connected host=localhost pool=20
```

"Successfully" is noise (the absence of an error already says it); decoration is noise; facts, identifiers, and durations are the signal.

## Detection heuristics (reviewing existing code)

- High comment-to-code ratio with zero WHY content -> run the finishing pass
- try/catch count far exceeds recovery-logic count
- Suffix smells: `Impl`, `Manager`, `Helper`, `Utils`, `V2`, `Enhanced`, `New`
- `?.` and `??` density in code with a strict type schema
- Every function documented equally, regardless of importance
- Vocabulary: robust/comprehensive/seamless in comments; ✨ anywhere
- Diff touches formatting/renames far outside the requested change
