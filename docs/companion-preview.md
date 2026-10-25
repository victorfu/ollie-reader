# Companion interactions and outfit preview

This is the first delivery for #28: P0 interactions and six temporary outfit
previews. It does not implement purchases, ownership, inventory persistence,
the P1 performances or the deferred collection expansion.

- Tap either ear, the belly or the right hand to react. Drag in turn mode to
  rotate. In pet mode, stroke the head or either ear. The action panel offers
  keyboard-accessible equivalents, plus jump and twirl.
- Actions replace the current performance and automatically finish. Changing
  interaction mode cancels the previous gesture. Reduced motion keeps the
  facial response while suppressing performance movement.
- Outfit previews are local React state only. Selecting another item for a
  slot replaces it; selecting it again removes it. Exiting discards previews.
  No Firestore writes, token deductions or ownership claims occur.
- Head, face, neck and hand anchors follow their corresponding animated pivots.
  The six accessory meshes are original procedural geometry in `Accessories.tsx`,
  with no imported artwork. The bundled character's CC BY 4.0 attribution remains
  in its license file and the page's model credits.

## Deferred shop prerequisite

The repository does not contain the complete deployed Firestore rules. Current
game rewards use browser-side transactions, not a trusted settlement backend.
Before adding paid inventory, establish and test the authoritative economy
boundary across adventure rewards, other game rewards, gacha and purchases.
Do not present client validation alone as prevention of forged coins or grants.
The new inventory must remain isolated from legacy `cloudCottage` data.

## Release checks still required

Physical iOS Safari, Android Chrome and desktop Safari touch/rendering checks,
30fps mobile / near-60fps desktop measurements, and broader release asset rights
checks remain outstanding. Chromium software WebGL and touch emulation are useful
functional checks but are not physical-device performance measurements.
