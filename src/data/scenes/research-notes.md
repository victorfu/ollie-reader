# Travel English Research Notes: Taiwan to Singapore Journey
# 旅行英語研究筆記：台灣到新加坡之旅

**Target:** 4th Grade Elementary Students (國小四年級, ~10 years old)
**Journey:** Taiwan (home) → Taoyuan Airport → Flight → Singapore Changi → Explore → Return

---

## Current State Analysis

### Existing Scenes (singapore-general.ts)
1. Airport & Flying — covers check-in, boarding, immigration, customs (too broad, needs splitting)
2. Hotel
3. Food & Hawker Centre
4. Getting Around (MRT, bus, taxi)
5. Attractions & Fun
6. Shopping
7. Asking for Help

### Existing Scenes (mandai files)
8. Mandai Wildlife Reserve Hub
9. Singapore Zoo
10. Night Safari
11. River Wonders
12. Bird Paradise
13. Rainforest Wild ASIA
14. Dining at Mandai
15. Mandai Rainforest Resort

### Gap Analysis — Missing Scenes
The task calls for a **journey-based sequence**. These are currently missing:
1. **出發前 (Before Departure)** — Packing, passport, excitement
2. **飛機上 (On the Plane)** — Find seat, in-flight service, meals, bathroom, arrival card
3. **新加坡入境 (Singapore Arrival)** — Split from current "Airport" scene; immigration, customs, baggage claim, money exchange
4. **回程 (Return Trip)** — Tax refund at airport, boarding back to Taiwan, goodbye Singapore

The existing "Airport & Flying" scene needs to be **split** into:
- Taoyuan Airport (check-in, luggage, security, gate)
- On the Plane (separate new scene)
- Singapore Arrival (immigration, customs, luggage pickup, currency)

---

## Proposed Scene Reorganization

### Section: "Journey" (旅程)

The new section covers the travel journey itself, organized chronologically:

| # | Scene ID | Title | Title Chinese | Emoji | Status |
|---|----------|-------|---------------|-------|--------|
| 1 | `before-departure` | Before the Trip | 出發前準備 | 🧳 | **NEW** |
| 2 | `taoyuan-airport` | Taoyuan Airport | 桃園機場 | 🛫 | **SPLIT** from airport |
| 3 | `on-the-plane` | On the Plane | 飛機上 | ✈️ | **NEW** |
| 4 | `changi-arrival` | Arriving in Singapore | 新加坡入境 | 🛬 | **SPLIT** from airport |
| 5 | `transport` | Getting Around | 交通出行 | 🚇 | existing, keep |
| 6 | `hotel` | Hotel | 飯店住宿 | 🏨 | existing, keep |
| 7 | `food` | Food & Hawker Centre | 美食與小販中心 | 🍜 | existing, keep |
| 8 | `attractions` | Attractions & Fun | 景點與娛樂 | 🎢 | existing, keep |
| 9 | `shopping` | Shopping | 購物 | 🛍️ | existing, keep |
| 10 | `help` | Asking for Help | 求助 | 🆘 | existing, keep |
| 11 | `going-home` | Going Home | 回家囉 | 🏠 | **NEW** |

### Section: "Mandai Wildlife Reserve" (萬態野生動物保育區) — keep as-is

---

## New Scene Details

### Scene 1: Before the Trip (出發前準備) — NEW

```
id: "before-departure"
title: "Before the Trip"
titleChinese: "出發前準備"
emoji: "🧳"
description: "Pack your bags, check your passport, and get ready for an exciting trip to Singapore!"
colorClass: "bg-violet-50"
```

#### Vocabulary (10 words)
| Word | Chinese | Emoji | Phonetic | Example |
|------|---------|-------|----------|---------|
| suitcase | 行李箱 | 🧳 | SOOT-kays | I need to pack my suitcase. |
| passport | 護照 | 🛂 | PASS-port | Don't forget your passport! |
| clothes | 衣服 | 👕 | klohthz | I packed three T-shirts and two shorts. |
| toothbrush | 牙刷 | 🪥 | TOOTH-brush | Did you pack your toothbrush? |
| sunscreen | 防曬乳 | 🧴 | SUN-skreen | Singapore is hot. Bring sunscreen! |
| umbrella | 雨傘 | ☂️ | um-BREL-uh | Bring an umbrella for rain. |
| charger | 充電器 | 🔌 | CHAR-jer | I need my phone charger. |
| medicine | 藥 | 💊 | MED-ih-sin | Mom packed some medicine just in case. |
| excited | 興奮的 | 🤩 | ek-SY-tid | I'm so excited about the trip! |
| ready | 準備好 | ✅ | RED-ee | Are you ready to go? |

#### Phrases (8 sentences)
| ID | English | Chinese | Situation |
|----|---------|---------|-----------|
| before-p1 | I'm so excited about our trip! | 我好期待我們的旅行！ | feelings |
| before-p2 | Did you pack your passport? | 你有帶護照嗎？ | packing |
| before-p3 | How many days are we going? | 我們要去幾天？ | planning |
| before-p4 | I need to pack my suitcase. | 我需要整理行李箱。 | packing |
| before-p5 | What's the weather like in Singapore? | 新加坡的天氣怎麼樣？ | planning |
| before-p6 | Singapore is very hot and humid. | 新加坡又熱又潮濕。 | knowledge |
| before-p7 | Don't forget your toothbrush! | 別忘了帶牙刷！ | packing |
| before-p8 | Are we ready to go? | 我們準備好出發了嗎？ | departure |

#### Dialogues

**Dialogue 1: Packing Together (一起打包行李)**
> You and your mom are packing the night before the trip.

| Speaker | Role | English | Chinese |
|---------|------|---------|---------|
| A | Child | Mom, I'm so excited! We're going to Singapore tomorrow! | 媽，我好興奮！我們明天要去新加坡了！ |
| B | Mom | Me too! Let's pack your suitcase. What do you need? | 我也是！我們來整理你的行李箱。你需要帶什麼？ |
| A | Child | T-shirts, shorts, and my swimsuit! | T恤、短褲，還有我的泳衣！ |
| B | Mom | Good. Singapore is very hot, so pack light clothes. | 很好。新加坡很熱，所以帶輕薄的衣服。 |
| A | Child | Do I need a jacket? | 我需要帶外套嗎？ |
| B | Mom | Yes, bring a thin one. The airplane and MRT are cold! | 要，帶一件薄的。飛機和地鐵上會冷！ |
| A | Child | Okay! And I want to bring my camera. | 好！我還想帶我的相機。 |
| B | Mom | Sure! Don't forget your toothbrush and sunscreen. | 好！別忘了牙刷和防曬乳。 |

**Dialogue 2: Checking the Passport (檢查護照)**
> Dad checks that everything is ready before leaving home.

| Speaker | Role | English | Chinese |
|---------|------|---------|---------|
| A | Dad | Let me check. Passport? | 我確認一下。護照？ |
| B | Child | Here it is! | 在這裡！ |
| A | Dad | Boarding pass? | 登機證？ |
| B | Child | Mom printed it. It's in the bag. | 媽媽印好了。在包包裡。 |
| A | Dad | Great. Phone charger? | 很好。手機充電器？ |
| B | Child | Yes! I also packed my umbrella. | 有！我也帶了雨傘。 |
| A | Dad | Smart! It rains a lot in Singapore. Are you ready? | 聰明！新加坡常下雨。你準備好了嗎？ |
| B | Child | Ready! Let's go to the airport! | 準備好了！我們去機場吧！ |

#### Fun Facts (趣味小知識)
- Singapore is called the "Lion City" (獅城)! The name comes from "Singapura" which means "Lion City" in Malay.
- Singapore is close to the equator, so it's summer all year round — always hot and humid (~30°C). Pack light clothes!
- The flight from Taoyuan to Singapore is about 4.5 hours.

---

### Scene 2: Taoyuan Airport (桃園機場) — SPLIT from existing "airport"

```
id: "taoyuan-airport"
title: "Taoyuan Airport"
titleChinese: "桃園機場"
emoji: "🛫"
description: "Check in for your flight, drop off your luggage, go through security, and find your gate."
colorClass: "bg-sky-50"
```

#### Vocabulary (10 words)
| Word | Chinese | Emoji | Phonetic | Example |
|------|---------|-------|----------|---------|
| boarding pass | 登機證 | 🎫 | BOR-ding pass | Here is your boarding pass. |
| check-in counter | 報到櫃檯 | 🧑‍💼 | CHEK-in KOWN-ter | Go to the check-in counter first. |
| luggage | 行李 | 🧳 | LUG-ij | How many pieces of luggage do you have? |
| security | 安檢 | 🔒 | seh-KYOOR-ih-tee | We need to go through security. |
| gate | 登機門 | 🚪 | gayt | Your gate is B12. |
| passport | 護照 | 🛂 | PASS-port | Please show me your passport. |
| window seat | 靠窗座位 | 🪟 | WIN-doh seet | Can I have a window seat? |
| aisle seat | 靠走道座位 | 💺 | AYL seet | I'd like an aisle seat, please. |
| departure | 出發 | 🛫 | dee-PAR-chur | The departure time is 3 PM. |
| terminal | 航廈 | 🏢 | TUR-mih-nul | We are in Terminal 2. |

#### Phrases (8 sentences)
| ID | English | Chinese | Situation |
|----|---------|---------|-----------|
| taoyuan-p1 | I'd like to check in, please. | 我想辦理登機手續。 | check-in |
| taoyuan-p2 | Can I have a window seat? | 可以給我靠窗的座位嗎？ | check-in |
| taoyuan-p3 | I have one suitcase to check in. | 我有一個行李箱要託運。 | luggage |
| taoyuan-p4 | Where is Gate B5? | B5 登機門在哪裡？ | navigation |
| taoyuan-p5 | Is this the line for security? | 這是安檢的隊伍嗎？ | security |
| taoyuan-p6 | Can I bring water through security? | 我可以帶水過安檢嗎？ | security |
| taoyuan-p7 | What time do we board? | 我們幾點登機？ | boarding |
| taoyuan-p8 | The plane is boarding now! | 飛機正在登機了！ | boarding |

#### Dialogues

**Dialogue 1: Checking In at the Counter (在櫃檯辦理登機)**
> You arrive at Taoyuan Airport and check in for your flight to Singapore.

| Speaker | Role | English | Chinese |
|---------|------|---------|---------|
| A | You | Hi, I'd like to check in for my flight to Singapore. | 你好，我想辦理飛往新加坡的登機手續。 |
| B | Staff | Sure! May I see your passport, please? | 好的！請讓我看看您的護照。 |
| A | You | Here you go. | 給你。 |
| B | Staff | Would you like a window or aisle seat? | 您要靠窗還是靠走道的座位？ |
| A | You | A window seat, please! I want to see the clouds. | 靠窗的，麻煩你！我想看雲。 |
| B | Staff | How many bags are you checking in? | 您要託運幾件行李？ |
| A | You | Just one suitcase. | 只有一個行李箱。 |
| B | Staff | Here's your boarding pass. Your gate is B5. Have a nice flight! | 這是您的登機證。您的登機門是B5。祝您旅途愉快！ |

**Dialogue 2: Going Through Security (通過安檢)**
> You go through the security checkpoint with your family.

| Speaker | Role | English | Chinese |
|---------|------|---------|---------|
| A | Child | Do I need to take off my backpack? | 我需要把背包拿下來嗎？ |
| B | Dad | Yes, put it on the belt. And take out your water bottle. | 要，放在輸送帶上。還有把水壺拿出來。 |
| A | Child | Why can't I bring my water? | 為什麼我不能帶水？ |
| B | Dad | You can't bring liquids through security. We'll buy water inside. | 液體不能帶過安檢。我們進去裡面再買。 |
| A | Child | Okay! What about my tablet? | 好！那我的平板呢？ |
| B | Dad | Take it out of your bag and put it in a separate tray. | 把它從包包拿出來，放在另一個托盤裡。 |
| A | Child | Done! Can we get some snacks after? | 好了！之後可以買零食嗎？ |
| B | Dad | Sure! There are lots of shops after security. | 當然！過了安檢有很多商店。 |

#### Fun Facts
- Taoyuan Airport (桃園機場) has a Hello Kitty gate area and cool art installations!
- You need to arrive at the airport at least 2 hours before your flight.
- Liquids over 100ml cannot go through security — buy drinks after you pass!

---

### Scene 3: On the Plane (飛機上) — NEW

```
id: "on-the-plane"
title: "On the Plane"
titleChinese: "飛機上"
emoji: "✈️"
description: "Find your seat, enjoy in-flight meals, use the bathroom, and fill out the arrival card."
colorClass: "bg-blue-50"
```

#### Vocabulary (10 words)
| Word | Chinese | Emoji | Phonetic | Example |
|------|---------|-------|----------|---------|
| seat belt | 安全帶 | 🔐 | SEET belt | Please fasten your seat belt. |
| flight attendant | 空服員 | 👨‍✈️ | FLYT uh-TEN-dunt | The flight attendant is very kind. |
| tray table | 餐桌 | 🍽️ | tray TAY-bul | Put down your tray table for the meal. |
| headphones | 耳機 | 🎧 | HED-fohnz | Can I have some headphones? |
| blanket | 毯子 | 🛏️ | BLANK-it | May I have a blanket, please? |
| turbulence | 亂流 | 🌊 | TUR-byoo-luns | Don't worry, it's just turbulence. |
| arrival card | 入境卡 | 📝 | uh-RY-vul kard | You need to fill out the arrival card. |
| chicken or fish | 雞肉還是魚 | 🍗 | CHIK-en or fish | Chicken or fish for your meal? |
| juice | 果汁 | 🧃 | joos | Can I have apple juice, please? |
| landing | 降落 | 🛬 | LAN-ding | We will be landing in 30 minutes. |

#### Phrases (8 sentences)
| ID | English | Chinese | Situation |
|----|---------|---------|-----------|
| plane-p1 | Excuse me, where is seat 25A? | 不好意思，25A 座位在哪裡？ | finding seat |
| plane-p2 | Can I have some water, please? | 可以給我一些水嗎？ | drinks |
| plane-p3 | Chicken, please. | 請給我雞肉。 | meal |
| plane-p4 | May I have a blanket? It's cold. | 可以給我毯子嗎？好冷。 | comfort |
| plane-p5 | Excuse me, I need to go to the bathroom. | 不好意思，我想去上廁所。 | bathroom |
| plane-p6 | How much longer until we land? | 還要多久才降落？ | time |
| plane-p7 | Please fasten your seat belt. | 請繫好安全帶。 | safety |
| plane-p8 | Can you help me fill out this card? | 你可以幫我填這張卡嗎？ | arrival card |

#### Dialogues

**Dialogue 1: Finding Your Seat (找座位)**
> You board the plane and find your seat.

| Speaker | Role | English | Chinese |
|---------|------|---------|---------|
| A | You | Excuse me, where is seat 25A? | 不好意思，25A 座位在哪裡？ |
| B | Flight Attendant | Go straight. It's on your left side, by the window. | 往前走。在您的左手邊，靠窗戶。 |
| A | You | Thank you! Can I put my bag up here? | 謝謝！我可以把包包放上面嗎？ |
| B | Flight Attendant | Sure! Let me help you. It's a bit high. | 當然！讓我幫你。有點高。 |
| A | You | Wow, I can see the wing from my window! | 哇，我從窗戶可以看到機翼！ |
| B | Flight Attendant | Please fasten your seat belt. We'll take off soon. | 請繫好安全帶。我們馬上要起飛了。 |
| A | You | How long is the flight to Singapore? | 飛到新加坡要多久？ |
| B | Flight Attendant | About four and a half hours. Enjoy your flight! | 大約四個半小時。祝您飛行愉快！ |

**Dialogue 2: Meal Time on the Plane (飛機上的餐點)**
> The flight attendant comes with the meal cart.

| Speaker | Role | English | Chinese |
|---------|------|---------|---------|
| B | Flight Attendant | Would you like chicken or fish? | 你要雞肉還是魚？ |
| A | You | Chicken, please. | 請給我雞肉。 |
| B | Flight Attendant | Here you go. And would you like something to drink? | 給你。你要喝什麼嗎？ |
| A | You | Apple juice, please. | 蘋果汁，謝謝。 |
| B | Flight Attendant | Sure! Here's your apple juice. | 好的！這是你的蘋果汁。 |
| A | You | Thank you! Um, may I have a blanket too? It's a little cold. | 謝謝！嗯，可以給我毯子嗎？有點冷。 |
| B | Flight Attendant | Of course! Here you are. | 當然！給你。 |
| A | You | Thank you so much! | 非常感謝！ |

**Dialogue 3: Filling Out the Arrival Card (填寫入境卡)**
> Mom helps you fill out the Singapore arrival card before landing.

| Speaker | Role | English | Chinese |
|---------|------|---------|---------|
| A | Child | Mom, what is this card? | 媽，這張卡是什麼？ |
| B | Mom | It's the arrival card for Singapore. We need to fill it out. | 這是新加坡的入境卡。我們需要填寫。 |
| A | Child | What do I write here? | 這裡要寫什麼？ |
| B | Mom | Write your full name. Then your passport number. | 寫你的全名。然後是護照號碼。 |
| A | Child | What about "Purpose of Visit"? | 那「來訪目的」呢？ |
| B | Mom | Write "Holiday." And for the address, write our hotel name. | 寫「Holiday」。地址的話，寫我們飯店的名字。 |
| A | Child | Done! We're almost landing! I can see the ocean! | 寫好了！我們快降落了！我可以看到海！ |
| B | Mom | Yes! Welcome to Singapore! Put your tray table up and fasten your seat belt. | 對！歡迎來到新加坡！把餐桌收起來，繫好安全帶。 |

#### Fun Facts
- The flight from Taiwan to Singapore is about 4.5 hours — you have time to watch a movie!
- Singapore used to require paper arrival cards, but now most travelers use the electronic SG Arrival Card (SGAC) app instead. Your parents can fill it out online before the trip!
- When the plane flies over the South China Sea, you might see tiny islands from your window.

---

### Scene 4: Arriving in Singapore (新加坡入境) — SPLIT from existing "airport"

```
id: "changi-arrival"
title: "Arriving in Singapore"
titleChinese: "新加坡入境"
emoji: "🛬"
description: "Go through immigration, pick up your luggage, exchange money, and say hello to Singapore!"
colorClass: "bg-emerald-50"
```

#### Vocabulary (10 words)
| Word | Chinese | Emoji | Phonetic | Example |
|------|---------|-------|----------|---------|
| immigration | 移民關 | 🛂 | im-ih-GRAY-shun | Let's go through immigration first. |
| customs | 海關 | 🛃 | KUS-tumz | You need to go through customs. |
| baggage claim | 行李轉盤 | 🧳 | BAG-ij klaym | Our luggage is at baggage claim 5. |
| money exchange | 換錢 | 💱 | MUH-nee eks-CHAYNJ | Where is the money exchange? |
| Singapore dollar | 新加坡幣 | 💵 | SING-uh-por DAH-ler | I need to change to Singapore dollars. |
| vacation | 度假 | 🏖️ | vay-KAY-shun | I'm here for a vacation. |
| carousel | 行李轉盤 | 🔄 | kair-uh-SEL | Wait at carousel number 5. |
| nothing to declare | 沒有東西要申報 | ✅ | NUTH-ing too dee-KLAIR | I have nothing to declare. |
| SIM card | SIM 卡 | 📱 | sim kard | Should we buy a SIM card? |
| information counter | 服務台 | ℹ️ | in-for-MAY-shun KOWN-ter | Let's ask at the information counter. |

#### Phrases (8 sentences)
| ID | English | Chinese | Situation |
|----|---------|---------|-----------|
| changi-p1 | I'm here for a vacation with my family. | 我和家人來度假。 | immigration |
| changi-p2 | We're staying for five days. | 我們會待五天。 | immigration |
| changi-p3 | I have nothing to declare. | 我沒有東西要申報。 | customs |
| changi-p4 | Where can I pick up my luggage? | 我在哪裡領行李？ | baggage |
| changi-p5 | Which carousel is for flight CI753? | CI753 航班的行李在哪個轉盤？ | baggage |
| changi-p6 | Where is the money exchange? | 換錢的地方在哪裡？ | money |
| changi-p7 | I'd like to change Taiwan dollars to Singapore dollars. | 我想把台幣換成新加坡幣。 | money |
| changi-p8 | How do we get to the city from here? | 從這裡要怎麼去市區？ | transport |

#### Dialogues

**Dialogue 1: Going Through Immigration (通過移民關)**
> You arrive at Changi Airport and go through Singapore immigration.

| Speaker | Role | English | Chinese |
|---------|------|---------|---------|
| B | Officer | Passport, please. | 請出示護照。 |
| A | You | Here is my passport. | 這是我的護照。 |
| B | Officer | What is the purpose of your visit? | 您來訪的目的是什麼？ |
| A | You | I'm here for a vacation with my family. | 我和家人來度假。 |
| B | Officer | How long will you be staying? | 您會待多久？ |
| A | You | Five days. | 五天。 |
| B | Officer | Where will you be staying? | 您會住在哪裡？ |
| A | You | At the Marina Bay Hotel. | 在濱海灣飯店。 |

**Dialogue 2: Picking Up Luggage and Exchanging Money (領行李和換錢)**
> You find your luggage and exchange money at the airport.

| Speaker | Role | English | Chinese |
|---------|------|---------|---------|
| A | Child | Dad, where do we get our bags? | 爸，我們在哪裡拿行李？ |
| B | Dad | Look at the screen. Our flight is at carousel 5. Let's go! | 看螢幕。我們的航班在第五號轉盤。走吧！ |
| A | Child | I see our blue suitcase! There it is! | 我看到我們的藍色行李箱了！在那裡！ |
| B | Dad | Good eyes! Grab it carefully. Now let's change some money. | 好眼力！小心拿。現在我們去換一些錢。 |
| A | Child | Excuse me, I'd like to change Taiwan dollars to Singapore dollars. | 不好意思，我想把台幣換成新加坡幣。 |
| B | Cashier | How much would you like to change? | 您想換多少？ |
| A | Child | Ten thousand Taiwan dollars, please. | 一萬台幣，麻煩你。 |
| B | Cashier | Here you go. That's about 430 Singapore dollars. | 給你。大約四百三十新加坡幣。 |

#### Fun Facts
- Changi Airport (樟宜機場) has been voted the best airport in the world many times! It has a butterfly garden, a movie theater, and even a swimming pool.
- The Jewel at Changi has the world's tallest indoor waterfall — the Rain Vortex (雨漩渦)!
- Singapore uses the Singapore dollar (SGD). 1 SGD ≈ 23 TWD (approximate).
- Singapore has 4 official languages: English, Mandarin, Malay, and Tamil!

---

### Scene 11: Going Home (回家囉) — NEW

```
id: "going-home"
title: "Going Home"
titleChinese: "回家囉"
emoji: "🏠"
description: "Get a tax refund at the airport, say goodbye to Singapore, and fly back to Taiwan!"
colorClass: "bg-rose-50"
```

#### Vocabulary (10 words)
| Word | Chinese | Emoji | Phonetic | Example |
|------|---------|-------|----------|---------|
| tax refund | 退稅 | 💰 | taks REE-fund | You can get a tax refund at the airport. |
| receipt | 收據 | 🧾 | ree-SEET | Keep your receipts for the tax refund. |
| souvenir | 紀念品 | 🎁 | soo-vuh-NEER | I bought souvenirs for my friends. |
| duty-free | 免稅 | 🛍️ | DOO-tee free | Let's look at the duty-free shop. |
| gate | 登機門 | 🚪 | gayt | Our gate is C15. |
| delay | 延誤 | ⏰ | dee-LAY | I hope the flight is not delayed. |
| goodbye | 再見 | 👋 | good-BY | Goodbye, Singapore! |
| memories | 回憶 | 📸 | MEM-er-eez | I have so many great memories! |
| boarding | 登機 | 🛫 | BOR-ding | Boarding starts in twenty minutes. |
| home | 家 | 🏠 | hohm | I can't wait to go home and tell everyone! |

#### Phrases (8 sentences)
| ID | English | Chinese | Situation |
|----|---------|---------|-----------|
| home-p1 | Where is the tax refund counter? | 退稅櫃檯在哪裡？ | tax refund |
| home-p2 | I'd like to get a tax refund, please. | 我想辦理退稅。 | tax refund |
| home-p3 | Here are my receipts. | 這是我的收據。 | tax refund |
| home-p4 | What gate is our flight? | 我們的航班在哪個登機門？ | boarding |
| home-p5 | Can I buy some snacks for my friends? | 我可以買一些零食給朋友嗎？ | shopping |
| home-p6 | Goodbye, Singapore! I'll miss you! | 再見，新加坡！我會想你的！ | farewell |
| home-p7 | I had a wonderful time! | 我玩得很開心！ | farewell |
| home-p8 | I can't wait to come back! | 我等不及要再來！ | farewell |

#### Dialogues

**Dialogue 1: Getting a Tax Refund (辦理退稅)**
> You go to the GST refund counter at Changi Airport before your flight home.

| Speaker | Role | English | Chinese |
|---------|------|---------|---------|
| A | You | Excuse me, where is the tax refund counter? | 不好意思，退稅櫃檯在哪裡？ |
| B | Staff | It's near the check-in area. Do you have your receipts? | 在報到區附近。您有收據嗎？ |
| A | You | Yes, here they are. I bought some souvenirs. | 有，在這裡。我買了一些紀念品。 |
| B | Staff | Let me check... You can get twelve dollars back. Cash or card? | 我看看⋯⋯您可以退回十二元。要現金還是退到卡？ |
| A | You | Cash, please. | 現金，麻煩你。 |
| B | Staff | Here you go. Have a safe flight home! | 給你。祝您平安回家！ |
| A | You | Thank you! Goodbye, Singapore! | 謝謝！再見，新加坡！ |
| B | Staff | Goodbye! Come back again soon! | 再見！歡迎再來！ |

**Dialogue 2: Last Moments at the Airport (在機場的最後時光)**
> You and your family wait at the gate to fly back to Taiwan.

| Speaker | Role | English | Chinese |
|---------|------|---------|---------|
| A | Child | Mom, I don't want to leave Singapore! | 媽，我不想離開新加坡！ |
| B | Mom | I know! But we can come back again someday. What was your favorite part? | 我知道！但我們有一天可以再來。你最喜歡什麼？ |
| A | Child | I loved the Night Safari! The animals were so cool at night! | 我最喜歡夜間動物園！動物在晚上好酷！ |
| B | Mom | Mine was the hawker centre. The chicken rice was delicious! | 我最喜歡小販中心。雞飯好好吃！ |
| A | Child | Can I eat my Merlion cookies on the plane? | 我可以在飛機上吃我的魚尾獅餅乾嗎？ |
| B | Mom | Of course! Oh look, they're calling our flight. Let's go! | 當然！噢你看，他們在叫我們的航班了。走吧！ |
| A | Child | Goodbye, Singapore! I had a wonderful time! | 再見，新加坡！我玩得很開心！ |
| B | Mom | Say "See you again"! | 說「See you again」！ |

#### Fun Facts
- In Singapore, tourists can get a GST (Goods and Services Tax) refund on purchases over $100 SGD. Save your receipts!
- Changi Airport's duty-free shops have lots of snacks and souvenirs — perfect last-minute gifts!
- You can use the Changi Airport app to find your gate, track your flight, and even pre-order food.
- "Merlion cookies" (魚尾獅餅乾) are the most popular souvenir from Singapore!

---

## Existing Scenes — Recommended Improvements

### Scene: Getting Around (transport) — Keep, add fun fact
- **Add fun fact:** Singapore's MRT is super clean! Eating, drinking, and chewing gum are not allowed on the MRT. You can get fined!
- **Add fun fact:** In Singapore, people say "Grab" instead of "Uber" for ride-hailing.

### Scene: Hotel — Keep, add fun fact
- **Add fun fact:** Many Singapore hotels have an infinity pool on the rooftop! Marina Bay Sands has the most famous one.

### Scene: Food & Hawker Centre — Keep, add fun fact
- **Add fun fact:** In Singapore, people use "lah" at the end of sentences. "Can, lah!" means "Yes, sure!"
- **Add fun fact:** Hawker centres are like big outdoor food courts. They are so important to Singapore's culture that they were added to UNESCO's list!
- **Add fun fact:** "Teh" means tea in Hokkien/Malay, "Kopi" means coffee. You can order "teh-O" (tea without milk) or "kopi-C" (coffee with evaporated milk).

### Scene: Attractions & Fun — Keep, add fun fact
- **Add fun fact:** The Merlion (魚尾獅) is half-lion, half-fish. It's the symbol of Singapore!
- **Add fun fact:** Gardens by the Bay's Supertrees light up every night with a music and light show at 7:45 PM and 8:45 PM. It's free!

### Scene: Shopping — Keep, add fun fact
- **Add fun fact:** Orchard Road (烏節路) is Singapore's most famous shopping street — it's 2.2 km long!

### Scene: Asking for Help — Keep, add fun fact
- **Add fun fact:** Singapore's emergency number is 999 for police and 995 for ambulance/fire.
- **Add fun fact:** Most people in Singapore speak English, so don't be afraid to ask for help!

---

## Summary of Data Changes for Implementation

### New file structure proposal:

```
src/data/scenes/
├── journey-before-departure.ts     # NEW
├── journey-taoyuan-airport.ts      # NEW (split from singapore-general airport)
├── journey-on-the-plane.ts         # NEW
├── journey-changi-arrival.ts       # NEW (split from singapore-general airport)
├── journey-going-home.ts           # NEW
├── singapore-general.ts            # MODIFY: remove old "airport" scene, keep rest
├── singapore-mandai.ts             # KEEP
├── singapore-mandai-hub.ts         # KEEP
├── singapore-mandai-dining.ts      # KEEP
├── singapore-mandai-resort.ts      # KEEP
```

### Updated travelScenes.ts sections:

```typescript
export const sceneSections: SceneSection[] = [
  {
    id: "journey",
    title: "The Journey",
    titleChinese: "旅程",
    emoji: "✈️",
    scenes: [
      beforeDepartureScene,        // NEW
      taoyuanAirportScene,         // NEW (split)
      onThePlaneScene,             // NEW
      changiArrivalScene,          // NEW (split)
      ...singaporeGeneralScenes,   // MODIFIED (airport removed)
      goingHomeScene,              // NEW
    ],
  },
  {
    id: "mandai-wildlife",
    title: "Mandai Wildlife Reserve",
    titleChinese: "萬態野生動物保育區",
    emoji: "🦁",
    scenes: [ /* keep existing */ ],
  },
];
```

### Cultural Notes to Add as Optional Field

Consider adding a `funFacts` field to the `TravelScene` type:

```typescript
export interface TravelScene {
  // ... existing fields ...
  funFacts?: FunFact[];
}

export interface FunFact {
  emoji: string;
  english: string;
  chinese: string;
}
```

This enables each scene to display 2-3 cultural fun facts for kids, making learning more engaging.

---

## Content Guidelines Summary

1. **Language Level:** Simple sentences, mostly present tense, common verbs (have, want, can, like, need, go, see, eat)
2. **Sentence Length:** Keep to 5-10 words where possible
3. **Dialogue Style:** Natural, warm, with parent-child or child-staff interactions
4. **Cultural Elements:** Singlish (lah, can), food names (teh, kopi, Milo), local customs
5. **Phonetics:** Simple stress-based phonetic guides (e.g., PASS-port, not IPA)
6. **Emotional Engagement:** Express excitement, curiosity, slight nervousness — relatable for kids
7. **Practical Focus:** Sentences kids would actually use or hear during a real trip
