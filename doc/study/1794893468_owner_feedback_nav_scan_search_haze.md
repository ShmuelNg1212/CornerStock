# Owner feedback: tab bar, serial mix-up, search, and top haze

Date: 2026-11-17. Source: the human's message and a phone screenshot of the home-screen app (stock screen, owner account).

## 1. Tab bar: "account and settings icons crammed together"

- The phone tab bar is in `src/components/nav.tsx` (`variant="tabs"`). It has 3 columns: Stock, Scan, and a third item. The third item is Settings for the owner and Account for staff.
- The top bar in `src/components/shell.tsx` also has an Account link: the round initial ("S") at the right.
- The screenshot shows a correct 3-item bar. The fault does not show in the code or in the screenshot.
- Possible causes (not confirmed):
  - The owner sees two account controls (the "S" at the top and Settings at the bottom) and reads them as one crowded group.
  - A larger text size or a narrow phone pushes the label into the scan button.
  - The owner's phone has an older build.
- A screenshot from the owner's phone is necessary to find the fault.

## 2. Scan puts the product code into the serial number

Evidence: a barcode read of the 10 fixture photos in `src/lib/label/__fixtures__/`.

| Photo | Codes read (format, text, top edge in px) |
|---|---|
| 01 | Code39 23VSLE30B047 (1496), EAN13 UPC (1634), Code39 BBMVSL15L (1796) |
| 04 | Code39 26GRNE12B037 (636), Code39 BBMGRN14L (1097). No UPC. |
| 06 | EAN13 UPC only |
| 07 | nothing |
| 08 | Code39 BBMRTQ15L (435), EAN13 UPC (582). No serial. |
| 09 | Code39 25RTQI26I031 (1361), EAN13 UPC (1514), Code39 BBMRTQ14L (1658) |

Findings:

- The serial number and the product code both use Code 39. The barcode format cannot tell them apart.
- `classifyBarcodes` in `src/lib/label/barcodes.ts` uses the position first. The shape is only a tie-break in one case.
- Photo 08 shows the fault. Only the product code and the UPC read. In the photo, the product code is above the UPC. Then the rule "one code below the UPC that starts with a letter" does not apply. The fallback puts the product code into the serial number.
- The same fallback applies when no UPC reads and only the product code reads.
- The text shape separates the two codes on all fixtures:
  - A serial number starts with 2 digits (the year), then letters: `23VSLE30B047`.
  - A product code starts with letters and ends with the ball weight and a letter: `BBMVSL15L`, `BBMGRN14L`.
- The catalog stores `product_code` for each model. `lookupLabel` in `src/app/actions.ts` returns it for a known UPC. The scan does not compare the serial with it.
- In batch mode, a product code read as the serial makes the next box of the same model a "duplicate". The staff member sees a wrong message.
- The database function `receive_ball` accepts any serial of 6 to 30 letters and digits. It does not refuse a serial that is equal to a product code.
- All fixtures are Storm-group labels. Labels from other makers can use other serial forms.

## 3. Search is too strict

- The stock search is `filterGroups` in `src/lib/stock/group.ts`. The catalog search is in `src/components/catalog/catalog-list.tsx`. Both use lower case and a plain `includes` for each word.
- Lower case already makes the search case-insensitive. The faults are:
  - Punctuation must match. "hyroad" does not find "Hy-Road".
  - Look-alike characters do not match. "iq" does not find "!Q Tour".
  - One wrong letter finds nothing.
- The serial search (`searchSerials`) uses `ilike` on the server. It is case-insensitive already.

## 4. Haze at the top of the home-screen app

- The layout sets `statusBarStyle: "black-translucent"` (`src/app/layout.tsx`). Two earlier fixes painted the root and the safe area navy (commits 1390a70, 8f40664). The haze stays.
- The screenshot shows a grey gradient over the navy, with dark status bar text. The page cannot paint this gradient. iOS draws it.
- Developer reports say that iOS 26.1 and later draw a system blur over the top of home-screen apps that use `black-translucent`. CSS cannot remove it. Sources: [autobrr/qui#2520](https://github.com/autobrr/qui/issues/2520), [alkalye#67](https://github.com/carlassmann/alkalye/pull/67), [planestro#558](https://github.com/gravesisme/planestro/issues/558), [cairn-web#72](https://github.com/JoanRoucoux/cairn-web/pull/72).
- The common fix is `statusBarStyle: "default"`. The page then starts below an opaque status bar. iOS does not draw the blur over the page.
- Reports do not agree that `theme-color` tints that bar on iOS 26.1. A device check is necessary.
- iOS reads the style when the app is added to the home screen. The owner must remove the app and add it again.
