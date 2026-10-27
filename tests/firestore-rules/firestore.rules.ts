import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const ALICE = { uid: "alice", email: "alice@example.com" };
const BOB = { uid: "bob", email: "bob@example.com" };
const STRANGER = { uid: "stranger", email: "stranger@example.com" };

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-ollie-reader",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "allowedUsers", ALICE.email), {});
    await setDoc(doc(db, "allowedUsers", BOB.email), {});
    await setDoc(doc(db, "vocabulary", "alice-word"), { userId: ALICE.uid, word: "apple" });
    await setDoc(doc(db, "vocabulary", "bob-word"), { userId: BOB.uid, word: "banana" });
    await setDoc(doc(db, "speeches", "alice-speech"), { userId: ALICE.uid, name: "Talk" });
    await setDoc(doc(db, "sentencePractice", "alice-sentence"), {
      userId: ALICE.uid, speechId: "alice-speech", order: 0, english: "Hi",
    });
    await setDoc(doc(db, "users", ALICE.uid, "podcasts", "p1"), { url: "https://a.example" });
    await setDoc(doc(db, "gameProgress", ALICE.uid), { coins: 1 });
    await setDoc(doc(db, "gameProgress", ALICE.uid, "littleGames", "gacha"), { pulls: 1 });
    await setDoc(doc(db, "userSettings", ALICE.uid), { userId: ALICE.uid });
    await setDoc(doc(db, "workspaces", "old"), { userId: ALICE.uid });
  });
});

function as(user: { uid: string; email: string }, emailVerified = true): Firestore {
  return env
    .authenticatedContext(user.uid, { email: user.email, email_verified: emailVerified })
    .firestore() as unknown as Firestore;
}

describe("access gate", () => {
  it("denies signed-out visitors", async () => {
    const db = env.unauthenticatedContext().firestore() as unknown as Firestore;
    await assertFails(getDoc(doc(db, "users", ALICE.uid, "podcasts", "p1")));
  });

  it("denies users who are not on the allow-list, even for their own paths", async () => {
    await assertFails(setDoc(doc(as(STRANGER), "users", STRANGER.uid, "podcasts", "p"), { url: "x" }));
  });

  it("denies unverified emails", async () => {
    await assertFails(getDoc(doc(as(ALICE, false), "users", ALICE.uid, "podcasts", "p1")));
  });

  it("lets users read only their own allow-list entry", async () => {
    await assertSucceeds(getDoc(doc(as(ALICE), "allowedUsers", ALICE.email)));
    await assertFails(getDoc(doc(as(ALICE), "allowedUsers", BOB.email)));
    await assertFails(setDoc(doc(as(ALICE), "allowedUsers", STRANGER.email), {}));
  });

  it("closes collections the rules do not list", async () => {
    await assertFails(getDoc(doc(as(ALICE), "workspaces", "old")));
    await assertFails(setDoc(doc(as(ALICE), "travelProgress", ALICE.uid), { userId: ALICE.uid }));
  });
});

describe("paths keyed by uid", () => {
  it("allows the owner and denies everyone else under users/{uid}", async () => {
    await assertSucceeds(getDocs(collection(as(ALICE), "users", ALICE.uid, "podcasts")));
    await assertSucceeds(setDoc(doc(as(ALICE), "users", ALICE.uid, "wordPractice", "state"), { words: {} }));
    await assertFails(getDocs(collection(as(BOB), "users", ALICE.uid, "podcasts")));
    await assertFails(deleteDoc(doc(as(BOB), "users", ALICE.uid, "podcasts", "p1")));
  });

  it("guards gameProgress and its subcollections", async () => {
    await assertSucceeds(updateDoc(doc(as(ALICE), "gameProgress", ALICE.uid), { coins: 2 }));
    await assertSucceeds(getDoc(doc(as(ALICE), "gameProgress", ALICE.uid, "littleGames", "gacha")));
    await assertFails(getDoc(doc(as(BOB), "gameProgress", ALICE.uid)));
    await assertFails(setDoc(doc(as(BOB), "gameProgress", ALICE.uid, "littleGames", "gacha"), { pulls: 99 }));
  });

  it("keeps userSettings owned and stamped with the owner", async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), "userSettings", ALICE.uid), { userId: ALICE.uid, theme: "dark" }));
    await assertFails(setDoc(doc(as(BOB), "userSettings", BOB.uid), { userId: ALICE.uid }));
    await assertFails(getDoc(doc(as(BOB), "userSettings", ALICE.uid)));
  });
});

describe("collections with a userId owner field", () => {
  it("reads own documents and denies other users' documents", async () => {
    await assertSucceeds(getDoc(doc(as(ALICE), "vocabulary", "alice-word")));
    await assertFails(getDoc(doc(as(ALICE), "vocabulary", "bob-word")));
  });

  it("allows reading a document that does not exist yet", async () => {
    await assertSucceeds(getDoc(doc(as(ALICE), "vocabulary", "not-saved-yet")));
  });

  it("allows queries filtered by the owner and rejects the rest", async () => {
    const db = as(ALICE);
    await assertSucceeds(getDocs(query(collection(db, "vocabulary"), where("userId", "==", ALICE.uid))));
    await assertFails(getDocs(query(collection(db, "vocabulary"), where("userId", "==", BOB.uid))));
    await assertFails(getDocs(collection(db, "vocabulary")));
  });

  it("allows owner-scoped speech queries and rejects speechId-only ones", async () => {
    const db = as(ALICE);
    await assertSucceeds(getDocs(query(
      collection(db, "sentencePractice"),
      where("userId", "==", ALICE.uid),
      where("speechId", "==", "alice-speech"),
      orderBy("order", "asc"),
    )));
    await assertFails(getDocs(query(
      collection(db, "sentencePractice"),
      where("speechId", "==", "alice-speech"),
    )));
  });

  it("creates only documents stamped with the caller as owner", async () => {
    await assertSucceeds(setDoc(doc(as(ALICE), "speeches", "new"), { userId: ALICE.uid, name: "New" }));
    await assertFails(setDoc(doc(as(ALICE), "speeches", "forged"), { userId: BOB.uid, name: "Forged" }));
    await assertFails(setDoc(doc(as(ALICE), "speeches", "unowned"), { name: "No owner" }));
  });

  it("updates own documents but never hands them to someone else", async () => {
    await assertSucceeds(updateDoc(doc(as(ALICE), "vocabulary", "alice-word"), { word: "apples" }));
    await assertFails(updateDoc(doc(as(ALICE), "vocabulary", "alice-word"), { userId: BOB.uid }));
    await assertFails(updateDoc(doc(as(ALICE), "vocabulary", "bob-word"), { userId: ALICE.uid }));
  });

  it("deletes only own documents", async () => {
    await assertFails(deleteDoc(doc(as(ALICE), "vocabulary", "bob-word")));
    await assertSucceeds(deleteDoc(doc(as(ALICE), "vocabulary", "alice-word")));
  });
});
