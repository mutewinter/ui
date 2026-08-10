---
"@shadcn/react": patch
---

Fix MessageScroller jumping to the wrong turn when a row is replaced without the item count changing. The branch that handles an anchor appearing in place looked for the first anchor the controller had not already handled, but nothing seeded that set: anchors already on screen when the scroller mounted, and anchors that arrived as appends, were all still unhandled, so the first one in the transcript won and the view snapped to the top of the thread. Every anchor is now marked as the content pass ends, whichever branch handled it, so only a row that becomes an anchor between passes reads as a turn opening in place. `getUnanchoredScrollAnchor` also walks from the end, since the turn that just opened is the last one.
