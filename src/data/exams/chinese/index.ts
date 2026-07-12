import type { ExamPaper } from "../../../types/exam";
import { CHINESE_SECTION_1 } from "./section1";
import { CHINESE_SECTION_2 } from "./section2";
import { CHINESE_SECTION_3 } from "./section3";
import { CHINESE_SECTION_4 } from "./section4";
import { CHINESE_SECTION_5 } from "./section5";

export const chinesePaper: ExamPaper = {
  subject: "chinese",
  title: "四年級國語練習卷",
  questionPdf: "/exams/四年級國語練習卷-題目卷.pdf",
  answerPdf: "/exams/國語自主練習解析卷.pdf",
  answerPdfLabel: "解析卷",
  totalQuestions: 100,
  sections: [
    { id: "chi-s1", title: "一、選擇題", questions: CHINESE_SECTION_1 },
    { id: "chi-s2", title: "二、字詞義測驗", questions: CHINESE_SECTION_2 },
    { id: "chi-s3", title: "三、修辭練習", questions: CHINESE_SECTION_3 },
    { id: "chi-s4", title: "四、成語基礎練習", questions: CHINESE_SECTION_4 },
    { id: "chi-s5", title: "五、成語進階練習", questions: CHINESE_SECTION_5 },
  ],
};
