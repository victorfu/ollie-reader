import type { ExamPaper } from "../../../types/exam";
import { ENGLISH_SECTION_1 } from "./section1";
import { ENGLISH_SECTION_2 } from "./section2";
import { ENGLISH_SECTION_3 } from "./section3";
import { ENGLISH_SECTION_4 } from "./section4";

export const englishPaper: ExamPaper = {
  subject: "english",
  title: "英語聽說評量練習卷",
  questionPdf: "/exams/english_examp_papers.jpg",
  questionPdfLabel: "參考講義",
  totalQuestions: 100,
  sections: [
    { id: "eng-s1", title: "一、單字選擇", subtitle: "第 1~30 題", questions: ENGLISH_SECTION_1 },
    { id: "eng-s2", title: "二、句型問答", subtitle: "第 31~55 題", questions: ENGLISH_SECTION_2 },
    { id: "eng-s3", title: "三、教室用語", subtitle: "第 56~75 題", questions: ENGLISH_SECTION_3 },
    { id: "eng-s4", title: "四、句子練習", subtitle: "第 76~100 題", questions: ENGLISH_SECTION_4 },
  ],
};
