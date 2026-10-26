# Companion interactions, wardrobe and shop

Deliveries for #28 so far: P0 interactions, six accessories, and the shop
that sells them for the shared gacha tokens. The P1 performances and the
deferred collection expansion are not implemented yet.

- Tap either ear, the belly or the right hand to react. Drag in turn mode to
  rotate. In pet mode, stroke the head or either ear. The action panel offers
  keyboard-accessible equivalents, plus jump and twirl.
- Actions replace the current performance and automatically finish. Changing
  interaction mode cancels the previous gesture. Reduced motion keeps the
  facial response while suppressing performance movement.
- Head, face, neck and hand anchors follow their corresponding animated pivots.
  The six accessory meshes are original procedural geometry in `Accessories.tsx`,
  with no imported artwork. The bundled character's CC BY 4.0 attribution remains
  in its license file and the page's model credits.

## Wardrobe and shop

- The bottom bar offers 動作 (including 摸摸頭), 換裝 and 商店. Both the
  wardrobe and the shop are bottom sheets with slot filters.
- Anyone can try any accessory on. Try-ons are local React state, labelled
  試穿中, never saved and discarded on exit. Guests can browse prices but
  every buy button is disabled.
- Signed-in players buy with `gameProgress/{uid}.coins`, the balance shared
  with Word Adventure, the gacha machine and the other games. Prices live in
  `COMPANION_PRICES` (`logic/outfit.ts`): bow 50, hat 100, glasses 120,
  scarf 150, plush 180, crown 300. Calibrate them against real stage rewards
  before release.
- Purchases and equipment are stored in
  `gameProgress/{uid}/littleGames/companionWardrobe`, beside the gacha save.
  The retired `cloudCottage` data is not read, written or deleted.
- One Firestore transaction checks the catalog price, ownership and balance,
  lowers `coins`, records the item and puts it on. Insufficient tokens,
  already-owned items and failures write nothing. Each attempt carries a
  purchase id; a retry after an uncertain failure reuses it, so a lost reply
  cannot charge twice. Concurrent purchases from other tabs are serialized by
  the transaction and the later one is refused as already owned. A double tap
  while a purchase is in flight is ignored. Buying is disabled offline.
- Owned items are put on or taken off in either sheet and saved
  immediately; the saved equipment only ever holds owned items. The wardrobe
  and balance are live snapshots, so other tabs and devices update.

## Trust boundary

`companion-wardrobe-firestore-rules.fragment` lets an accessory be added only
in the same commit that lowers the balance by its price, and equipment only
hold owned items. It must be merged into the deployed rules by hand and has
not been run against the Firestore emulator. Game rewards are still granted
by browser-side transactions, so these rules cannot stop a forged balance;
that needs a trusted settlement backend for every reward and purchase.

## Release checks still required

Physical iOS Safari, Android Chrome and desktop Safari touch/rendering checks,
30fps mobile / near-60fps desktop measurements, and broader release asset rights
checks remain outstanding. Chromium software WebGL and touch emulation are useful
functional checks but are not physical-device performance measurements.
