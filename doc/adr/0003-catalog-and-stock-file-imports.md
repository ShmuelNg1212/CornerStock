# 0003: Catalog and stock file imports match by UPC and serial number

Date: 2026-11-17. Status: accepted. Decided by: the human (plan approval on 2026-11-17).

## Context

The owner must prepare the catalog before stock arrives, and must load existing records from files. Until this change, only a label scan created a model or a ball. The study first proposed that an import keeps existing records unchanged. The human chose updates with a review instead.

## Decision

1. The catalog has bowling balls only. All staff browse it. Only the owner creates, edits, imports, and exports.
2. Files are CSV or `.xlsx`. One file has 1,000 data rows and 5 MB at most.
3. Identity:
   - A catalog entry is one UPC at one nominal weight. An import matches a catalog entry by UPC.
   - A ball is one serial number. An import matches an existing ball by serial number.
   - The UPC and the nominal weight of a catalog entry never change. The serial number, the UPC, and the sale status of a ball never change.
4. A new catalog entry needs a UPC, a model name, and a weight. A new ball needs a serial number and a UPC. A known UPC gives the missing model details.
5. A row for an existing ball can leave the UPC blank. The ball keeps its stored UPC. A different UPC is an error.
6. An import can update an existing catalog entry and correct the measurements, boxed date, and location of an existing ball. Each batch that changes an existing ball needs a reason. The reason is in the ball history.
7. A blank cell keeps the stored value. `__CLEAR__` clears an optional value. It never clears a required value or an identifier.
8. Rows for the same UPC must agree on each catalog value that they supply. A conflict is an error. The last row does not win.
9. The owner sees every change before the save. The batch saves completely or not at all. A record that changed after the review stops the save.
10. Each batch has a permanent record. A retry with the same request id gives the first result and writes nothing again.

## Not decided

Other product categories, images, suppliers, costs, catalog deletion, quantity-only stock, sale imports, and offline writes are out of scope.

## Consequences

- Stock changes from an import go through `commit_catalog_import`, a database function, in one transaction. The movement rules of a scan, a transfer, and a correction still apply.
- A test import on production leaves a permanent batch record. Test imports belong on the staging project ([../wiki/setup.md](../wiki/setup.md), "Staging").

Sources: [../study/1794847172_catalog_and_file_import.md](../study/1794847172_catalog_and_file_import.md), [../plan/1794847248_catalog_and_file_import.md](../plan/1794847248_catalog_and_file_import.md).
