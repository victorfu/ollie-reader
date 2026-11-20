// Keep new lookups, regeneration, and phrase lookups equally comprehensive.
const DICTIONARY_DETAILS_REQUIREMENTS = `
- 義項完整度以一般現代英語辭典為準；學生程度只影響解釋用字，不影響收錄哪些意思。
- 列出所有有把握、現代英語仍在使用且意思明確不同的義項，不設定固定數量上限，也不要只選最常見的兩三個意思。
- 先逐一檢查名詞、動詞、形容詞、副詞及其他適用詞性，再檢查每個詞性下的不同意思；只列實際存在的詞性，但不能找到名詞後就漏掉動詞。
- 涵蓋字面義、常見引申義、比喻義，以及常見專業領域用法；需要特定搭配才成立的意思，要在解釋中標明搭配，不可當成單字獨立的意思。
- 每個不同義項各占一筆 definitions，"partOfSpeech" 使用英文詞性（例如 noun、verb）。只有相同詞性、相同意思的重複說法才合併，不要因意思相關就合併不同用法。
- 普通單字與大寫縮寫要區分。若收錄縮寫，須在英文與中文解釋中標明大寫形式及縮寫身分；縮寫不能取代普通單字的義項。
- 按使用頻率排列，最常見的意思放在前面。不要湊數、編造意思，或加入無法確定的罕見、過時用法。
- "definition" 必須是簡單清楚的英文對英文解釋，使用國小到國中學生容易理解的常見字，盡量簡短，但不能為了縮短而省略區分義項所需的資訊。
- "definitionChinese" 是該義項對應的繁體中文解釋。每個義項都必須同時包含英文與中文。
- 每個義項提供一個能清楚呈現該意思的簡短英文例句，放在 examples，順序與 definitions 對應，不要所有例句都只示範第一個意思。
- "examples" 必須是物件陣列，每筆固定使用 "sentence" 欄位存放非空白的英文例句，例如 {"sentence":"My tummy hurts."}；不可使用字串陣列，也不可將欄位改名為 english、example 或 text。
- 回覆前逐一核對：是否遺漏其他詞性、同一詞性的不同用法，或把相關但不同的意思合併；若有遺漏，先補齊再輸出 JSON。`;

export const translationPrompts = {
  word_details: (word: string) => `你是一個重視義項完整度的英英／英中字典助手，使用學生能理解的簡單文字。請完整解釋「${word}」這個英文單字，回覆 JSON：
{"definitions":[{"partOfSpeech":"詞性","definition":"簡單清楚的英文對英文解釋","definitionChinese":"對應的繁體中文解釋"}],"examples":[{"sentence":"例句"}]}

要求：
${DICTIONARY_DETAILS_REQUIREMENTS}

義項覆蓋範例（不是數量上限，也不是要求每個單字都有這些詞性）：
查 ram 時，除了 noun「公羊」，也要涵蓋 verb「衝撞、猛撞」與「用力塞入、壓入」等不同用法；若補充 RAM「隨機存取記憶體」，必須標明它是縮寫，不能只列公羊與記憶體就結束。其他查詢只列查詢詞本身的義項。

- 只回覆 JSON，不要任何其他說明。`,

  translation: (text: string) => `你是一個幫助國小學生學習英文的翻譯助手。請將以下英文翻譯成繁體中文，使用簡單易懂、適合小朋友理解的詞彙和句子。翻譯要準確但用字要簡單，避免使用艱深的詞彙。

英文原文：${text}

請只回覆翻譯後的中文，不要加任何其他說明。`,

  smart_lookup: (text: string) => `你是一個幫助國小學生學習英文的助手。請判斷以下英文輸入是「片語」還是「完整句子」，然後依類型回覆對應的 JSON。

英文輸入：${text}

判斷規則：
- 片語：慣用語、複合詞或不成完整句子的詞組（例如 "give up"、"ice cream"、"look forward to"）。
- 句子：有主詞和動詞、表達完整意思的句子（祈使句也算句子，例如 "Sit down."）。

如果是「片語」，回覆：
{"kind":"word","definitions":[{"partOfSpeech":"詞性","definition":"簡單清楚的英文對英文解釋","definitionChinese":"對應的繁體中文解釋"}],"examples":[{"sentence":"例句"}]}
${DICTIONARY_DETAILS_REQUIREMENTS}
- 上述義項完整性要求適用於整個片語，不要拆開解釋個別單字，也不要延伸到其他片語。

如果是「句子」，回覆：
{"kind":"sentence","chinese":"翻譯後的繁體中文","keyWords":[{"word":"較難的英文單字","meaning":"簡短的繁體中文意思"}]}
- "chinese" 是整句的繁體中文翻譯，使用簡單易懂、適合小朋友理解的詞彙。翻譯要準確但用字要簡單，避免使用艱深的詞彙。
- "keyWords" 從句子裡挑出 1-3 個對國小學生比較難的單字，每個附上簡短（5 個字以內）的繁體中文意思。如果沒有難字，回覆空陣列 []。

只回覆 JSON，不要任何其他說明。`,

  sentence_parse: (text: string) => `你是一個幫助學生學習英文的助手。請將以下英文文字分句，並翻譯成繁體中文。

英文文字：
${text}

請以 JSON 格式回覆，格式如下：
{
  "sentences": [
    {
      "english": "完整的英文句子",
      "chinese": "對應的繁體中文翻譯"
    }
  ]
}

注意事項：
1. 根據英文標點符號（句號、問號、驚嘆號等）正確分句
2. 保持每個句子的完整性，不要拆散句子
3. 翻譯要準確、通順，使用簡單易懂的中文
4. 只回覆 JSON，不要加任何其他說明`,

  word_definition: (word: string) => `你是一個幫助學生學習英文的字典助手。請提供這個英文單字的簡短中文解釋。

單字：${word}

請用一句簡短的中文說明這個單字的意思，適合學生理解。只回覆中文解釋，不要加其他說明。`,
};

export type TranslationAction = keyof typeof translationPrompts;
