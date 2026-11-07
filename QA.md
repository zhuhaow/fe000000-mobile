# Browser acceptance checks

The DOM integration suite runs the original game engine against synthetic state. It cannot measure CSS layout, native dialog focus, Safari rendering, or touch behavior. Perform these checks before treating the interface as visually accepted.

## Viewports and appearance

- Test 320×568, 390×780, 430×932, tablet portrait, and 1440×900 desktop.
- Test dark, light, and system themes; change system appearance while the page remains open.
- Check that no page forces the document horizontally beyond the viewport. Long tables should scroll inside their labeled region.
- Check that long scientific exponents and alternative notations remain readable and do not overlap controls.
- Confirm normal purchase targets remain 44px high. Confirm Max all stays above the bottom navigation and the device safe area.
- With all eight generators visible, inspect the layout with and without autobuyers. Small screens may scroll; no control should be clipped or obscured.

## Progression and navigation

- Start a new game on a separate test origin. No locked groups or page names should appear in All.
- Import a test save through Complexity; visit every visible page, including Studies, challenges, Powers, Oracle, and Galaxies.
- Switch away from a long page and return: vertical position and each group's last page should be retained.
- Open All, jump across groups, close with X and Escape, and navigate using its bottom bar.
- Test the tab strip with touch, keyboard focus, and horizontal trackpad gestures.

## Purchases and progress

- Buy one generator, buy max for a tier, Max all, and toggle a tier autobuyer. Verify costs and outcomes against the original game using the same exported test save.
- Check safeguards and disabled buttons; no forbidden purchase may be made through the new controls.
- Check Boost, Sacrifice, and Prestige when available. Inspect all visible reset controls via Resets.
- Open Details and verify all original generator upgrades, explanations and controls remain reachable.
- Refresh, close/reopen, export/reimport, and simulate offline progress using a disposable test save.

## Complex pages and accessibility

- Inspect challenge descriptions, status and start/exit actions at phone width.
- Inspect all Studies, including purchased, affordable, unaffordable and forbidden states.
- Tap explanations and achievement descriptions; ensure the dialog shows the full current content.
- Navigate with keyboard only. Dialog focus must stay inside the open dialog and return to its trigger after closing.
- Test Safari on iPhone and Chrome on Android, including their expanded browser toolbars.

No personal save data is bundled with this repository.
