# Plan — play fixes for round, coil, and sum

Date: 2026-11-15 · Status: ready for review

Played on the live site with the mouse, the number keys, and the page API.

## Weakest point each

- Round: the English "Wrong pockets" label sits in the water and collides with the pier. Walking is `step:1`, so A and D do nothing.
- Coil: the steps are `n` `e` `s` `w`, so WASD changes the selection instead of moving the head. A click on the cell works.
- Sum: the detail plate covers the four pull buttons.

## Checklist

- [x] Compass step ids, with the old ids still accepted
- [x] Short miss label on the pier
- [x] Sum plate above the buttons
- [x] Tests, then lint and the portal check
