import type { ExamPaper } from "../../../types/exam";
import { MATH_PART_1 } from "./part1";
import { MATH_PART_2 } from "./part2";
import { MATH_PART_3 } from "./part3";
import { MATH_PART_4 } from "./part4";

export const mathPaper: ExamPaper = {
  subject: "math",
  title: "四年級數學練習卷",
  questionPdf: "/exams/四年級數學題目卷.pdf",
  answerPdf: "/exams/數學自主練習簡答卷.pdf",
  answerPdfLabel: "簡答卷",
  totalQuestions: 100,
  sections: [
    { id: "math-p1", title: "第一部分", subtitle: "第 1~25 題", questions: MATH_PART_1 },
    { id: "math-p2", title: "第二部分", subtitle: "第 26~50 題", questions: MATH_PART_2 },
    { id: "math-p3", title: "第三部分", subtitle: "第 51~75 題", questions: MATH_PART_3 },
    { id: "math-p4", title: "第四部分", subtitle: "第 76~100 題", questions: MATH_PART_4 },
  ],
};
