# Create Conference: "Venue" and "Venue address" (documented, not changed)

Requested separately so the owner can decide whether they should stay. **Nothing about them was changed** in the correction phase except layout (they are stacked full-width, as the prototype stacks its venue controls).

## What they are today (Next.js)
| | Venue | Venue address |
|---|---|---|
| Control | plain text input `#cc-venue`, placeholder "e.g. India Habitat Centre" (placeholder was "e.g. Taj Mahal Palace" before, changed to the prototype's) | plain text input `#cc-address`, no placeholder |
| Required | no | no |
| Shown when | the event format is not "Virtual" (also while no format is chosen yet) | same |
| Code | `features/conferences/components/create-conference-page.tsx` | same |

## Existing data flow (unchanged)
`NewConferenceInput.venue` / `.address` → `getConferenceRequestService().create()` (`services/supabase/conference-requests.ts`):
- **Venue → `conferences.venue` column** (`venue: blank(form.venue)`), read back in `list()` for "My Requests".
- **Venue address → `conferences.details.address`** (jsonb, key `address`; written as `undefined` when empty).
- Mock mode (`mocks/conference-requests.ts`) keeps them in memory only.
- Also read by the chair's Conference Details > Format & Venue tab (`services/supabase/chair.ts`: `venue` column, `state`, `details`), whose "Venue name" box edits the same `venue` column.
- Both feed the Live preview's location line (`venue, city, country`) and the request e-mail's "Location" detail in sample mode.

## Prototype equivalent (this corrects my earlier audit)
My first audit listed these two as "extra fields not in the prototype". **That was wrong.** The prototype has both (`CreateConferencePage`, `author-journey.jsx` ~36848-36866):
- They appear only after an event format other than "Virtual" has been chosen (`form.eventType && form.eventType !== "virtual"`). My screenshots had no format selected, so the prototype hid them.
- **Venue** is a `VenueSearchInput`: suggestions as you type (Google Places); picking one fills venue, address, city, state, country and postal code.
- **Venue address** is a `VenueMapPicker`: a map with a draggable pin that follows venue / city / country and writes the address back.
- Both depend on a Google Maps key and billing (decision D6, not provided).

## Differences that remain (for the owner's decision)
1. Visibility: prototype shows them only once a non-Virtual format is chosen; Next.js shows them immediately (kept as is, as instructed). Matching the prototype is a one-line change (`form.eventType && form.eventType !== "virtual"`).
2. Controls: prototype = Places search + map picker; Next.js = two text boxes (no map until D6).
3. Because of (1) the Next.js page is 167 px taller than the prototype's at first load (1440 px), the only height difference left.

## Options
- Keep as is (text boxes, always visible), or
- match the prototype's visibility now (hide until a non-Virtual format is chosen), and add Places + map when D6 (Maps key) is decided.
