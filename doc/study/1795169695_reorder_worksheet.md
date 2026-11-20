# Reorder worksheet study

## Shop task

The owner checks low stock before placing an order. The worksheet shows what is low and how many units sold recently. The owner enters the order quantities and downloads an Excel file.

## What exists

- The `low_stock` view returns one row for each UPC and active location below its minimum. A location with no balls counts as zero. A blank or zero minimum gives no row. See [low-stock rules](../adr/0004-low-stock-minimum.md).
- The sales report groups sales by catalog entry. It uses the location at the time of sale and Manila date boundaries. A cancellation removes its sale. A resale counts at the time and location of that resale. See [sales report rules](../adr/0006-sales-report-rules.md).
- The Activity screen already links to an owner-only report. It gives the owner a familiar entry point for the worksheet.
- The catalog export writes UPCs as text in Excel. The worksheet can reuse the Excel writer so a leading zero stays in the UPC.

## Options

1. Put a reorder export on the low-stock view. This reduces navigation. It puts owner sales data and quantity inputs in the staff stock screen.
2. Add an owner worksheet under Activity. This gives the owner one place to check counts, enter quantities, and export. It follows the access pattern of the sales report.
3. Save drafts as purchase orders. This supports handoff between devices. It also requires decisions about suppliers, draft ownership, and the order lifecycle.

## Proposed direction

Use the owner worksheet under Activity. Show one line per UPC and low-stock location. Show in-stock count, minimum, the gap to minimum, and recent units sold at that location. Use the current Manila date and the 29 dates before it. Show the date range on the page.

On a counter computer, use columns so the owner can compare counts. On a phone, put the same data in stacked rows with the quantity field beside its label. Use the current Activity controls and stock status marks. Put the download action near the worksheet title and show how many lines it will include.

The quantity starts blank. Show the gap as a reference next to the entry field. Keep quantities in the open worksheet. The Excel file is the record the owner can keep or send.
