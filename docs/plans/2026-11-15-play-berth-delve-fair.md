# Plan — play fixes for berth, delve, and fair

Date: 2026-11-15 · Status: ready for review

Played on the live site with the mouse, the number keys, and the page API.

## Weakest point each

- Berth: docking the leftmost legal berth won 8 of 12 seeds, close to the careful line. One hazard touch now ends the run, and the test uses the leftmost berth rather than the suggested one.
- Delve: sideways and down were `shift` and `cut`, so WASD did not dig. They are `step:w`, `step:e`, and `step:s`. The old ids still resolve.
- Fair: the detail plate covered the price buttons. It sits above them.

## Checklist

- [x] Berth incident limit and leftmost test
- [x] Delve compass ids
- [x] Fair plate
- [x] Tests
