# Handoff

Concept board: [assets/cornerstock-brand-concept.png](assets/cornerstock-brand-concept.png)

## Objective

Continue developing **Cornerstock**, a bowling equipment stock and inventory management app for **Bowlers Corner**, a bowling supply shop at Sta. Lucia East Mall in the Philippines.

The user has confirmed **Cornerstock** as the app’s name. Carry the following brand direction and recommended tech stack forward without restarting naming exploration.

## Current State

A preliminary brand kit and visual concept board have been created. The board explores the app identity, logo, palette, typography, inventory interface, shelf labels, and app icon.

The board is a visual reference, not production artwork. Its interface, sample quantities, barcode, and product labels are illustrative.

Only the name is explicitly confirmed. The remaining brand and technical decisions below are recommendations to develop further.

## Decisions and Constraints

**Brand name:** Cornerstock  
**Endorsement:** For Bowlers Corner  
**Proposed tagline:** Every item. Accounted for.

This is a new identity for the inventory app, not a redesign of the business’s existing logo.

**Brand personality**

Organized, dependable, approachable, and precise, with restrained sporting energy. The app should feel comfortable for everyday shop staff.

**Logo concept**

A geometric corner or shelf bracket framing a bowling ball with three finger holes. The corner references Bowlers Corner; the shelf suggests inventory; the ball establishes the category.

Develop consistent versions for light and dark backgrounds, a standalone app icon, and a single-color mark. Recreate the selected concept as clean vector artwork before production.

**Palette**

| Color | Hex | Intended use |
|---|---|---|
| Ink navy | `#172A3A` | Primary text, navigation, logo |
| Warm ivory | `#F6F3EC` | Main backgrounds |
| Maple gold | `#D7A55B` | Highlights, dividers, labels |
| Signal orange | `#D45A32` | Actions and emphasis |
| Slate gray | `#6B747A` | Secondary information |

Use mostly ivory and navy. Keep orange and gold selective. Validate accessibility contrast for actual text and button combinations; introduce darker functional variants where needed.

Stock statuses should use explicit labels and icons alongside color.

**Typography**

- Space Grotesk: headings, brand display, wordmark starting point.
- Inter: navigation, forms, tables, and body copy.
- Use tabular numerals for quantities and prices.

**Visual language**

Maple wood, bowling equipment closeups, shelf labels, clean geometry, generous spacing, and readable stock tables. Avoid decorative clutter, neon effects, excessive gradients, and dense dashboards.

**Voice**

Short, direct, and helpful. Examples:

- “Receive stock”
- “3 pairs remaining”
- “Stock count saved”
- “Reserved”
- “Low stock”

## Deliverable

Use this brief and the attached board as the starting point for subsequent design or development work. No application has been built in this conversation.

**Recommended tech stack**

| Layer | Recommendation |
|---|---|
| Application | Next.js App Router + TypeScript |
| Styling | Tailwind CSS |
| UI components | shadcn/ui, customized to the brand |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Authorization | Database-enforced permissions and row-level security |
| Product images | Supabase Storage |
| Hosting | Vercel |
| App delivery | Responsive, installable progressive web app |

The recommendation assumes a small staff team and online-first operation on phones, tablets, and counter computers. It is not yet a confirmed requirement.

Keep inventory-changing operations authoritative on the server/database. Store credentials securely and never expose privileged database keys in the client.

**Proposed first-version scope**

1. Product catalog with images, SKUs, barcodes, suppliers, costs, and selling prices.
2. Variant-level stock:
   - Bowling balls: model and weight.
   - Shoes: model, size, sizing system, and handedness where applicable.
   - Bags: capacity and color.
   - Accessories: relevant size, color, or pack variants.
3. Receiving, sales deductions, returns, transfers, and stock adjustments.
4. Separate on-hand, reserved, and available quantities.
5. Low-stock thresholds per variant.
6. Purchase orders and supplier records.
7. Barcode entry, fast search, CSV import/export, and physical stock counts.
8. Owner, manager, and staff roles, with exact permissions to be defined.

**Inventory integrity**

- Record every stock movement with actor, timestamp, reason, and reference.
- Update stock atomically in database transactions.
- Prevent duplicate submissions from deducting stock twice.
- Prevent concurrent allocation of the same last available item.
- Correct mistakes through traceable reversing or adjustment entries.
- Verify receipts, reservations, returns, stock counts, and permissions end to end.

Use the existing checkout system as an integration source if the shop already has one. Reliable offline stock changes require an explicit synchronization and conflict-resolution design; an installable web app does not provide that automatically.

## Sources and Files

- Business reference: https://share.google/KkZbd3kqvLirxJQBi
- Attachment: `cornerstock-brand-concept.png` — generated visual direction; stored at `assets/cornerstock-brand-concept.png`.
- Next.js PWA guidance: https://nextjs.org/docs/app/guides/progressive-web-apps
- Supabase database documentation: https://supabase.com/docs/guides/database/overview
- Supabase permissions: https://supabase.com/docs/guides/database/postgres/row-level-security
- UI components: https://ui.shadcn.com/docs
- Hosting: https://vercel.com/docs/frameworks/full-stack/nextjs

## Remaining Work

Confirm the existing checkout workflow, number of stock locations, staff permissions, stock import source, and whether operations must continue during internet outages.

The name is selected, but domain and trademark availability have not been established. Preliminary searching found other retail uses of “Cornerstock.”

## Continue From Here

First review the attached board against this brief and acknowledge Cornerstock as the selected name. Preserve the completed naming work and use the proposed brand system and stack as your starting point.

Then continue with the user’s requested next deliverable. If none is specified, ask whether they want production brand assets, application screens, or a working app. Ask additional questions only when the answer materially affects that deliverable.
