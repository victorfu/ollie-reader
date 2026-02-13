#!/usr/bin/env node

/**
 * Fetch all Gabby's Dollhouse transcripts from subslikescript.com
 * and save them as static JSON files in public/transcripts/
 *
 * Usage: node scripts/fetch-transcripts.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseHTML } from "node-html-parser";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const OUTPUT_DIR = join(PROJECT_ROOT, "public", "transcripts");

const BASE_URL = "https://subslikescript.com";
const SERIES_PATH = "/series/Gabbys_Dollhouse-9165438";

const SEASONS = [
  {
    number: 1,
    episodes: [
      { number: 1, title: "Spaceship", slug: "episode-1-Spaceship" },
      { number: 2, title: "Gabby Gets the Hiccups", slug: "episode-2-Gabby_Gets_the_Hiccups" },
      { number: 3, title: "Hamster Kitties", slug: "episode-3-Hamster_Kitties" },
      { number: 4, title: "Kitty School", slug: "episode-4-Kitty_School" },
      { number: 5, title: "Kitty Cat Cam", slug: "episode-5-Kitty_Cat_Cam" },
      { number: 6, title: "Dollhouse Defenders", slug: "episode-6-Dollhouse_Defenders" },
      { number: 7, title: "Mixed-Up Dollhouse", slug: "episode-7-Mixed-Up_Dollhouse" },
      { number: 8, title: "Game Show", slug: "episode-8-Game_Show" },
      { number: 9, title: "Kitty Pirates", slug: "episode-9-Kitty_Pirates" },
      { number: 10, title: "MerCat Gets Her Sparkle Back", slug: "episode-10-MerCat_Gets_Her_Sparkle_Back" },
    ],
  },
  {
    number: 2,
    episodes: [
      { number: 1, title: "Itty Bitty Blossom", slug: "episode-1-Itty_Bitty_Blossom" },
      { number: 2, title: "Dollhouse Store Day", slug: "episode-2-Dollhouse_Store_Day" },
      { number: 3, title: "Kitty Fairy's Sleepover", slug: "episode-3-Kitty_Fairys_Sleepover" },
      { number: 4, title: "Let's Make a Movie!", slug: "episode-4-Lets_Make_a_Movie" },
      { number: 5, title: "Pete the Polar Bear", slug: "episode-5-Pete_the_Polar_Bear" },
      { number: 6, title: "Kitty Rangers", slug: "episode-6-Kitty_Rangers" },
      { number: 7, title: "The Meow-Mazing Games", slug: "episode-7-The_Meow-Mazing_Games" },
      { number: 8, title: "Pandy's Birthday", slug: "episode-8-Pandys_Birthday" },
    ],
  },
  {
    number: 3,
    episodes: [
      { number: 1, title: "The Dollhouse Hotel", slug: "episode-1-The_Dollhouse_Hotel" },
      { number: 2, title: "A Knight's Tail", slug: "episode-2-A_Knights_Tail" },
      { number: 3, title: "DJ's Glow Ride", slug: "episode-3-DJs_Glow_Ride" },
      { number: 4, title: "Rainy Day Banana", slug: "episode-4-Rainy_Day_Banana" },
      { number: 5, title: "CatRat the Bandit", slug: "episode-5-CatRat_the_Bandit" },
      { number: 6, title: "DJ Catnip Gets His Groove Back", slug: "episode-6-DJ_Catnip_Gets_His_Groove_Back" },
      { number: 7, title: "Kitty Fairy Gets Sick", slug: "episode-7-Kitty_Fairy_Gets_Sick" },
    ],
  },
  {
    number: 4,
    episodes: [
      { number: 1, title: "Cakey's Cupcake Cousins", slug: "episode-1-Cakeys_Cupcake_Cousins" },
      { number: 2, title: "It's Purrsday!", slug: "episode-2-Its_Purrsday" },
      { number: 3, title: "Dollhouse Safari", slug: "episode-3-Dollhouse_Safari" },
      { number: 4, title: "Fluffy Flufferton", slug: "episode-4-Fluffy_Flufferton" },
      { number: 5, title: "Abra-CAT-Dabra!", slug: "episode-5-Abra-CAT-Dabra" },
      { number: 6, title: "The Fairy Festival!", slug: "episode-6-The_Fairy_Festival" },
      { number: 7, title: "Dollhouse FairyTales", slug: "episode-7-Dollhouse_FairyTales" },
      { number: 8, title: "The Easter Kitty Bunny", slug: "episode-8-The_Easter_Kitty_Bunny" },
    ],
  },
  {
    number: 5,
    episodes: [
      { number: 1, title: "Gabby, I Shrunk the Kitties!", slug: "episode-1-Gabby_I_Shrunk_the_Kitties" },
      { number: 2, title: "Mission to CATurn", slug: "episode-2-Mission_to_CATurn" },
      { number: 3, title: "Doodlebook", slug: "episode-3-Doodlebook" },
      { number: 4, title: "Cupcake Tree", slug: "episode-4-Cupcake_Tree" },
      { number: 5, title: "Dollhouse Detectives", slug: "episode-5-Dollhouse_Detectives" },
      { number: 6, title: "Happy CAT-O-Ween!", slug: "episode-6-Happy_CAT-O-Ween" },
    ],
  },
  {
    number: 6,
    episodes: [
      { number: 1, title: "A CAT-Tabulous Christmas", slug: "episode-1-A_CAT-Tabulous_Christmas" },
      { number: 2, title: "CatRat's Puzzle Hunt", slug: "episode-2-CatRats_Puzzle_Hunt" },
      { number: 3, title: "Super Thinkers", slug: "episode-3-Super_Thinkers" },
      { number: 4, title: "Paper Cup Popper", slug: "episode-4-Paper_Cup_Popper" },
      { number: 5, title: "Dollhouse Dress-Up Chest", slug: "episode-5-Dollhouse_Dress-Up_Chest" },
      { number: 6, title: "Kico the KittyCorn", slug: "episode-6-Kico_the_KittyCorn" },
    ],
  },
  {
    number: 7,
    episodes: [
      { number: 1, title: "Planes, Trains, and Kitty Balloons", slug: "episode-1-Planes_Trains_and_Kitty_Balloons" },
      { number: 2, title: "True Fairy Friends", slug: "episode-2-True_Fairy_Friends" },
      { number: 3, title: "Googly Eyes", slug: "episode-3-Googly_Eyes" },
      { number: 4, title: "Spongey-Saurus", slug: "episode-4-Spongey-Saurus" },
      { number: 5, title: "Baby Box's Meow-Seum Day!", slug: "episode-5-Baby_Boxs_Meow-Seum_Day" },
      { number: 6, title: "Carlita the Ice Cream Truck!", slug: "episode-6-Carlita_the_Ice_Cream_Truck" },
    ],
  },
  {
    number: 8,
    episodes: [
      { number: 1, title: "The Magical Mermaid-Lantis", slug: "episode-1-The_Magical_Mermaid-Lantis" },
      { number: 2, title: "Snow Cruise", slug: "episode-2-Snow_Cruise" },
      { number: 3, title: "Baby Benny Box is Here!", slug: "episode-3-Baby_Benny_Box_is_Here" },
      { number: 4, title: "The Mermaid Cruise Ship", slug: "episode-4-The_Mermaid_Cruise_Ship" },
      { number: 5, title: "Charm Bracelet Treasure Hunt", slug: "episode-5-Charm_Bracelet_Treasure_Hunt" },
      { number: 6, title: "CatRat's KittyFish", slug: "episode-6-CatRats_KittyFish" },
    ],
  },
  {
    number: 9,
    episodes: [
      { number: 1, title: "Music Festival", slug: "episode-1-Music_Festival" },
      { number: 2, title: "Cakey's Birthday", slug: "episode-2-Cakeys_Birthday" },
      { number: 3, title: "Pandy's Bad Day", slug: "episode-3-Pandys_Bad_Day" },
      { number: 4, title: "Baby Box's Crafty-riffic Adventure", slug: "episode-4-Baby_Boxs_Crafty-riffic_Adventure" },
      { number: 5, title: "Silly Kitty Cubes", slug: "episode-5-Silly_Kitty_Cubes" },
      { number: 6, title: "Carlita's Ameowzing Race", slug: "episode-6-Carlitas_Ameowzing_Race" },
    ],
  },
];

function parseTranscriptHtml(html) {
  const root = parseHTML(html);
  const scriptDiv = root.querySelector(".full-script");
  if (!scriptDiv) {
    console.warn("  Could not find .full-script element");
    return [];
  }

  // Replace <br> with newlines in the raw HTML, then extract text
  const rawHtml = scriptDiv.innerHTML;
  const withNewlines = rawHtml.replace(/<br\s*\/?>/gi, "\n");
  const textOnly = parseHTML(withNewlines).textContent || "";

  const lines = textOnly
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((text, index) => ({ index, text }));
}

async function fetchTranscript(seasonNumber, slug) {
  const url = `${BASE_URL}${SERIES_PATH}/season-${seasonNumber}/${slug}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return parseTranscriptHtml(await response.text());
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let success = 0;
  let failed = 0;
  const totalEpisodes = SEASONS.reduce((sum, s) => sum + s.episodes.length, 0);

  console.log(`Fetching ${totalEpisodes} episodes across ${SEASONS.length} seasons...\n`);

  for (const season of SEASONS) {
    const seasonDir = join(OUTPUT_DIR, `season-${season.number}`);
    mkdirSync(seasonDir, { recursive: true });

    for (const episode of season.episodes) {
      const outPath = join(seasonDir, `${episode.slug}.json`);
      try {
        process.stdout.write(`S${season.number}E${episode.number} ${episode.title}... `);
        const lines = await fetchTranscript(season.number, episode.slug);
        writeFileSync(outPath, JSON.stringify(lines, null, 2));
        console.log(`${lines.length} lines`);
        success++;
      } catch (err) {
        console.log(`FAILED: ${err.message}`);
        failed++;
      }
      await sleep(800);
    }
  }

  console.log(`\nDone. ${success} succeeded, ${failed} failed out of ${totalEpisodes}.`);
  if (failed > 0) {
    process.exit(1);
  }
}

main();
