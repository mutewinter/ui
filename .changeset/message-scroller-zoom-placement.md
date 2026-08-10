---
"@shadcn/react": patch
---

Fix MessageScroller misplacing anchored turns, jump targets and the tail spacer under an ancestor CSS `zoom`. `getBoundingClientRect` reports on-screen pixels, which `zoom` scales, while `scrollTop`, `clientHeight` and computed padding stay in layout pixels, which it does not. The placement geometry added the two together, so an anchored turn landed at 126px on-screen instead of 96px at a zoom of 1.5, and the reserved room below it collapsed to nothing at 2. Rect-derived values are now converted to layout pixels (via `element.currentCSSZoom`, falling back to the rect-to-offset width ratio) before they meet a scroll metric, and the visibility reading line is scaled the other way to meet the rects it is compared against. The error was proportional to the distance measured, so it grew with how far the target sat below the fold.
