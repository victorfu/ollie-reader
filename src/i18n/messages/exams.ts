/**
 * "exams.*" strings. Keep zh and en on the same keys: the en object is typed
 * against the zh keys, so a missing translation fails tsc.
 *
 * Only the UI frame is translated. Questions, options, explanations and
 * passages in src/data/exams/** are the learning content and stay Chinese.
 * The paper/section/PDF-label keys below mirror data-layer values so they can
 * be translated at display time; keep their zh text identical to the data.
 */
export const examsZh = {
  // 科目
  "exams.subject.chinese": "國語",
  "exams.subject.math": "數學",
  "exams.subject.english": "英文",
  "exams.subject.mixed": "綜合",
  "exams.switcher.label": "選擇考科",

  // 卷名、大題名稱(對應 src/data/exams 的資料值,只在顯示時翻譯)
  "exams.paper.chinese": "四年級國語練習卷",
  "exams.paper.math": "四年級數學練習卷",
  "exams.paper.english": "英語聽說評量練習卷",
  "exams.pdf.questionPaper": "題目卷",
  "exams.pdf.answerExplanations": "解析卷",
  "exams.pdf.answerKey": "簡答卷",
  "exams.pdf.handout": "參考講義",
  "exams.scope.full": "完整測驗",
  "exams.scope.fullSubtitle": "全卷 {n} 題",
  "exams.scope.mixed": "隨機綜合卷",
  "exams.scope.range": "第 {from}~{to} 題",
  "exams.section.chi-s1": "一、選擇題",
  "exams.section.chi-s2": "二、字詞義測驗",
  "exams.section.chi-s3": "三、修辭練習",
  "exams.section.chi-s4": "四、成語基礎練習",
  "exams.section.chi-s5": "五、成語進階練習",
  "exams.section.math-p1": "第一部分",
  "exams.section.math-p2": "第二部分",
  "exams.section.math-p3": "第三部分",
  "exams.section.math-p4": "第四部分",
  "exams.section.eng-s1": "一、單字選擇",
  "exams.section.eng-s2": "二、句型問答",
  "exams.section.eng-s3": "三、教室用語",
  "exams.section.eng-s4": "四、句子練習",

  // 原卷題號
  "exams.question.number": "第 {n} 題",
  "exams.question.withSection": "{section}・第 {n} 題",
  "exams.question.withSubject": "{subject}・{label}",
  "exams.question.original": "原卷 {label}",

  // 共用
  "exams.common.exit": "離開",
  "exams.common.redoMistakes": "錯題重練",

  // 列表
  "exams.hub.resetProgress": "重設進度",
  "exams.hub.totalQuestions": "共 {n} 題",
  "exams.hub.questionCount": "{n} 題",
  "exams.hub.bestScore": "最佳成績",
  "exams.hub.notTried": "尚未挑戰",
  "exams.hub.start": "開始練習",
  "exams.hub.retryWrong": "錯題重練（{n}）",
  "exams.hub.footer": "答完每一題會立即顯示對錯與解析，可以重複練習到全對為止！",
  "exams.hub.footerNoExplanation": "答完每一題會立即顯示對錯，可以重複練習到全對為止！",
  "exams.hub.resetTitle": "重設{title}進度？",
  "exams.hub.resetMessage":
    "將清除{title}所有區段與完整測驗的最佳成績、最近成績及錯題紀錄；其他科目不受影響，且無法復原。",
  "exams.hub.resetConfirm": "重設進度",

  // 隨機綜合卷
  "exams.random.pool": "從三科題庫（共 {total} 題）隨機抽題",
  "exams.random.description":
    "每次產生都是一張新考卷：三科平均分配、題目不重複，依國語→數學→英文排列。隨機卷不記錄最佳成績。",
  "exams.random.countLabel": "題數",
  "exams.random.countAria": "選擇題數",
  "exams.random.countOption": "{n} 題",
  "exams.random.compositionEven": "國語、數學、英文各 {n} 題",
  "exams.random.compositionUneven": "國語、數學、英文各 {min}～{max} 題（隨機分配）",
  "exams.random.generate": "產生考卷並開始",
  "exams.random.footer": "答完每一題會立即顯示對錯與解析，錯題可以馬上重練！",

  // 作答
  "exams.quiz.progressAria": "練習進度：第 {n} 題，共 {total} 題",
  "exams.quiz.playQuestion": "播放題目語音",
  "exams.quiz.imageOption": "圖片中的選項 {mark}",
  "exams.quiz.optionAria": "{mark} {label}",
  "exams.quiz.optionAriaCorrect": "{mark} {label}，正確答案",
  "exams.quiz.optionAriaWrong": "{mark} {label}，你的答案，答錯",
  "exams.quiz.correct": "答對了！",
  "exams.quiz.wrong": "答錯了",
  "exams.quiz.wrongWithAnswer": "答錯了，正確答案是 {mark}",
  "exams.quiz.autoAdvance": "答對時自動下一題",
  "exams.quiz.viewSection": "查看區段統計",
  "exams.quiz.finish": "完成練習",
  "exams.quiz.next": "下一題",
  "exams.quiz.shortcutTyped": "輸入答案後按 Enter 或「送出」作答，作答後按 Enter 前往下一題",
  "exams.quiz.shortcutChoice": "可使用數字鍵 1-{n} 作答，Enter 前往下一題",

  // 答案標籤(後面接作答內容/考卷內容)
  "exams.answer.yours": "你的答案：",
  "exams.answer.correct": "正確答案：",
  "exams.answer.standard": "標準答案：",
  "exams.answer.explanation": "解析：",

  // 區段統計
  "exams.sectionResult.done": "區段完成",
  "exams.sectionResult.accuracy": "正確率",
  "exams.sectionResult.correctCount": "答對 {score} / {total} 題",
  "exams.sectionResult.viewTotal": "查看總成績",
  "exams.sectionResult.next": "繼續下一區段",

  // 成績
  "exams.result.scopeRetry": "{scope}・錯題重練",
  "exams.result.accuracyLine": "正確率・答對 {score} / {total} 題",
  "exams.result.perfect": "全部答對，太厲害了！",
  "exams.result.newBest": "新紀錄！",
  "exams.result.retryWrong": "錯題重練（{n} 題）",
  "exams.result.restart": "再練一次",
  "exams.result.backToList": "回列表",
  "exams.result.review": "錯題檢討（{n} 題）",

  // 打字作答
  "exams.typed.hint": "提示：",
  "exams.typed.wordBankAria": "打散的單字，點一下加入答案",
  "exams.typed.addWord": "加入單字 {word}",
  "exams.typed.clear": "清除重來",
  "exams.typed.unscrambleHelp": "點字卡把句子排出來，也可以直接輸入。",
  "exams.typed.playAudio": "播放語音(可重複點)",
  "exams.typed.noAudio": "這裝置無法播放語音，請直接把這句打出來：",
  "exams.typed.placeholder": "在這裡輸入英文句子…",
  "exams.typed.inputAria": "輸入你的答案",
  "exams.typed.submit": "送出",
  "exams.typed.replayHelp": "聽不清楚可以再按一次「播放語音」。",

  // 附圖
  "exams.image.alt": "第 {n} 題附圖",
  "exams.image.failed": "圖片載入失敗，請對照題目卷第 {n} 題。",
  "exams.image.openPaper": "開啟題目卷",
  "exams.image.zoomAria": "放大附圖：{alt}",
  "exams.image.closeZoom": "關閉放大檢視",

  // 離開確認
  "exams.exit.title": "離開目前的練習？",
  "exams.exit.message": "這次的作答進度不會保存喔。",
  "exams.exit.confirm": "離開",
  "exams.exit.cancel": "繼續作答",
} as const;

export const examsEn: Record<keyof typeof examsZh, string> = {
  "exams.subject.chinese": "Chinese",
  "exams.subject.math": "Math",
  "exams.subject.english": "English",
  "exams.subject.mixed": "Mixed",
  "exams.switcher.label": "Choose a subject",

  "exams.paper.chinese": "Grade 4 Chinese Practice Test",
  "exams.paper.math": "Grade 4 Math Practice Test",
  "exams.paper.english": "English Listening & Speaking Practice Test",
  "exams.pdf.questionPaper": "Question Paper",
  "exams.pdf.answerExplanations": "Answers & Explanations",
  "exams.pdf.answerKey": "Answer Key",
  "exams.pdf.handout": "Study Handout",
  "exams.scope.full": "Full Test",
  "exams.scope.fullSubtitle": "All {n} questions",
  "exams.scope.mixed": "Random Mixed Test",
  "exams.scope.range": "Questions {from}–{to}",
  "exams.section.chi-s1": "1. Multiple Choice",
  "exams.section.chi-s2": "2. Word Meanings",
  "exams.section.chi-s3": "3. Figures of Speech",
  "exams.section.chi-s4": "4. Idioms: Basics",
  "exams.section.chi-s5": "5. Idioms: Advanced",
  "exams.section.math-p1": "Part 1",
  "exams.section.math-p2": "Part 2",
  "exams.section.math-p3": "Part 3",
  "exams.section.math-p4": "Part 4",
  "exams.section.eng-s1": "1. Word Choice",
  "exams.section.eng-s2": "2. Questions & Answers",
  "exams.section.eng-s3": "3. Classroom English",
  "exams.section.eng-s4": "4. Sentence Practice",

  "exams.question.number": "Question {n}",
  "exams.question.withSection": "{section} · Question {n}",
  "exams.question.withSubject": "{subject} · {label}",
  "exams.question.original": "Original test: {label}",

  "exams.common.exit": "Exit",
  "exams.common.redoMistakes": "Redo Mistakes",

  "exams.hub.resetProgress": "Reset Progress",
  "exams.hub.totalQuestions": "{n} questions in all",
  "exams.hub.questionCount": "{n} questions",
  "exams.hub.bestScore": "Best score",
  "exams.hub.notTried": "Not tried yet",
  "exams.hub.start": "Start Practice",
  "exams.hub.retryWrong": "Redo Mistakes ({n})",
  "exams.hub.footer":
    "After each question you’ll see if you were right, plus an explanation. Keep practicing until you get them all right!",
  "exams.hub.footerNoExplanation":
    "After each question you’ll see if you were right. Keep practicing until you get them all right!",
  "exams.hub.resetTitle": "Reset progress for {title}?",
  "exams.hub.resetMessage":
    "This clears the best scores, latest scores and mistakes for every section and the full test of {title}. Other subjects stay the same. This can’t be undone.",
  "exams.hub.resetConfirm": "Reset Progress",

  "exams.random.pool": "Random questions from all three subjects ({total} in total)",
  "exams.random.description":
    "Every time you get a brand-new test: the three subjects are shared evenly, no question repeats, and they come in the order Chinese → Math → English. Random tests don’t save a best score.",
  "exams.random.countLabel": "Number of questions",
  "exams.random.countAria": "Choose how many questions",
  "exams.random.countOption": "{n} questions",
  "exams.random.compositionEven": "{n} questions each from Chinese, Math and English",
  "exams.random.compositionUneven":
    "{min}–{max} questions each from Chinese, Math and English (shared out randomly)",
  "exams.random.generate": "Make a Test and Start",
  "exams.random.footer":
    "After each question you’ll see if you were right, plus an explanation. You can redo your mistakes right away!",

  "exams.quiz.progressAria": "Progress: question {n} of {total}",
  "exams.quiz.playQuestion": "Play the question",
  "exams.quiz.imageOption": "Option {mark} in the picture",
  "exams.quiz.optionAria": "{mark} {label}",
  "exams.quiz.optionAriaCorrect": "{mark} {label}, correct answer",
  "exams.quiz.optionAriaWrong": "{mark} {label}, your answer, wrong",
  "exams.quiz.correct": "Correct!",
  "exams.quiz.wrong": "Not quite",
  "exams.quiz.wrongWithAnswer": "Not quite. The right answer is {mark}",
  "exams.quiz.autoAdvance": "Go to the next question when I’m right",
  "exams.quiz.viewSection": "See Section Results",
  "exams.quiz.finish": "Finish",
  "exams.quiz.next": "Next Question",
  "exams.quiz.shortcutTyped":
    "Type your answer and press Enter or “Submit”. After answering, press Enter for the next question",
  "exams.quiz.shortcutChoice": "Press number keys 1–{n} to answer, and Enter for the next question",

  "exams.answer.yours": "Your answer: ",
  "exams.answer.correct": "Correct answer: ",
  "exams.answer.standard": "Answer: ",
  "exams.answer.explanation": "Explanation: ",

  "exams.sectionResult.done": "Section Complete",
  "exams.sectionResult.accuracy": "Accuracy",
  "exams.sectionResult.correctCount": "{score} / {total} correct",
  "exams.sectionResult.viewTotal": "See Final Score",
  "exams.sectionResult.next": "Next Section",

  "exams.result.scopeRetry": "{scope} · Redo Mistakes",
  "exams.result.accuracyLine": "Accuracy · {score} / {total} correct",
  "exams.result.perfect": "All correct. Amazing!",
  "exams.result.newBest": "New record!",
  "exams.result.retryWrong": "Redo Mistakes ({n})",
  "exams.result.restart": "Practice Again",
  "exams.result.backToList": "Back to List",
  "exams.result.review": "Review Mistakes ({n})",

  "exams.typed.hint": "Hint:",
  "exams.typed.wordBankAria": "Mixed-up words. Tap one to add it to your answer",
  "exams.typed.addWord": "Add word {word}",
  "exams.typed.clear": "Clear",
  "exams.typed.unscrambleHelp": "Tap the word cards to build the sentence, or just type it.",
  "exams.typed.playAudio": "Play Audio (tap to replay)",
  "exams.typed.noAudio": "This device can’t play audio, so just type this sentence:",
  "exams.typed.placeholder": "Type the English sentence here…",
  "exams.typed.inputAria": "Type your answer",
  "exams.typed.submit": "Submit",
  "exams.typed.replayHelp": "Didn’t catch it? Tap “Play Audio” again.",

  "exams.image.alt": "Picture for question {n}",
  "exams.image.failed": "The picture didn’t load. Check question {n} on the question paper.",
  "exams.image.openPaper": "Open Question Paper",
  "exams.image.zoomAria": "Enlarge picture: {alt}",
  "exams.image.closeZoom": "Close enlarged picture",

  "exams.exit.title": "Leave this practice?",
  "exams.exit.message": "Your answers this time won’t be saved.",
  "exams.exit.confirm": "Leave",
  "exams.exit.cancel": "Keep Going",
};
