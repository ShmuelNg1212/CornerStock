# Ball box label: sample and field map

Sample: [assets/ball-box-label-sample.jpg](assets/ball-box-label-sample.jpg). The human supplied this photo as a typical label on a bowling ball box. It is one sample. Labels from other makers can differ.

## Human direction

- The main function of the app is to make the recording of bowling ball stock seamless.
- The whole store sees a live view of the current ball stock.
- The app scans a box label, extracts all the details, and adds the ball to the store stock.

## Fields on the sample

| Field | Value on sample | Scope |
|---|---|---|
| Model | Solid Lock | Model |
| Maker site | www.stormbowling.com | Model |
| Fragrance | Red Hot Cinnamon | Model |
| Color | Dark Red | Model |
| Coverstock | NeX Solid Reactive | Model |
| Weight block | RAD-X Core | Model |
| Ball finish | 1500-grit Polished | Model |
| RG | 2.48 | Model and weight |
| Diff | .054 | Model and weight |
| Mass bias | .018 | Model and weight |
| UPC barcode | 8 87970 61760 1 | Model and weight |
| Product code barcode | BBMVSL15L (small print, reading not certain) | Model and weight |
| Gross weight | 15 lbs 4 oz | One ball |
| Top weight | 3.28 | One ball |
| Pin distance | 3-3.5 | One ball |
| Serial barcode | 23VSLE30B047 | One ball |
| Boxed on | 5/30/2023 | One ball |

The UPC check digit is correct for the value read from the photo.

## Findings

- The label has three barcodes: a serial number, a UPC, and a product code.
- The serial number identifies one ball. Gross weight, top weight, and pin distance belong to that one ball.
- Thus ball stock is a list of individual balls, not only a quantity for each model and weight. The earlier proposal in the spec counted quantities for each variant.
- The UPC identifies the model and nominal weight. A scan of a known UPC can fill the model fields from the catalog. Only the per-ball fields then come from the label text.
- Gross weight, top weight, pin distance, and the boxed date are printed text only. A barcode scan does not give them. The app must read them from a photo.
- A text read from a photo can be wrong. The app must show the extracted fields for confirmation before it saves them.
- The serial number prevents a double entry of the same ball.

## Open questions

- Who sees the live view: staff only, or customers also (for example a screen in the store)?
- Do all ball makers that the shop stocks print a serial number and a UPC?
- Does the shop record the per-ball values today (top weight, pin distance), and do customers select a ball by them?
- Photo text extraction needs either on-device text recognition or a vision model on the server. The method is not selected.
