---
"@shadcn/react": patch
---

Fix MessageScroller anchoring a turn the reader has been looking at all along when rows open in the middle of the list. The append branch decided which anchor was new by index, taking the first one at or past the previous item count, which only holds while a list grows at its end. A collapsed row expanding grows it in the middle, so every anchor below the growth crossed that boundary without having moved: the scroller jumped to the last one, pinned it to the reading line, and reserved a tail spacer under it, all because the reader opened something. `getNewScrollAnchor` and `hasMultipleNewScrollAnchors` now take the handled-anchor set the in-place branch already uses, so a new anchor is one no content pass has seen rather than one that happens to sit past a boundary.
