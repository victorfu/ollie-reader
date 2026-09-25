import type {
  AnswerSpace,
  BankQuestion,
  BankSubject,
  Box,
  QuestionRegion,
  QuestionSource,
} from "../../types/questionBank";

export interface CropEditorState {
  source: QuestionSource;
  questions: BankQuestion[];
}

export type QuestionPatch = Partial<{
  subject: BankSubject;
  answer: string;
  answerSpace: AnswerSpace;
}>;

export type CropEditorAction =
  | { type: "createQuestion"; question: BankQuestion }
  | { type: "appendRegion"; questionId: string; region: QuestionRegion }
  | { type: "updateRegion"; questionId: string; regionIndex: number; box: Box }
  | { type: "removeRegion"; questionId: string; regionIndex: number }
  | { type: "updateQuestion"; questionId: string; patch: QuestionPatch }
  | { type: "deleteQuestion"; questionId: string }
  | { type: "addMask"; pageIndex: number; box: Box }
  | { type: "updateMask"; pageIndex: number; maskIndex: number; box: Box }
  | { type: "removeMask"; pageIndex: number; maskIndex: number }
  | { type: "renameSource"; title: string };

export type EditorChange =
  | { kind: "upsert"; id: string }
  | { kind: "delete"; id: string }
  | { kind: "source" };

type Regions = BankQuestion["regions"];

/** 陣列轉回「至少一個」的 tuple；呼叫端保證不為空。 */
function asRegions(list: QuestionRegion[]): Regions {
  const [first, ...rest] = list;
  return [first, ...rest];
}

function mapQuestion(
  state: CropEditorState,
  questionId: string,
  update: (question: BankQuestion) => BankQuestion,
): CropEditorState {
  return {
    ...state,
    questions: state.questions.map((question) =>
      question.id === questionId ? update(question) : question,
    ),
  };
}

function mapMasks(
  state: CropEditorState,
  pageIndex: number,
  update: (masks: Box[]) => Box[],
): CropEditorState {
  return {
    ...state,
    source: {
      ...state.source,
      pages: state.source.pages.map((page, index) =>
        index === pageIndex ? { ...page, masks: update(page.masks) } : page,
      ),
    },
  };
}

export function cropEditorReducer(
  state: CropEditorState,
  action: CropEditorAction,
): CropEditorState {
  switch (action.type) {
    case "createQuestion":
      return { ...state, questions: [...state.questions, action.question] };
    case "appendRegion":
      return mapQuestion(state, action.questionId, (question) => ({
        ...question,
        regions: [...question.regions, action.region],
      }));
    case "updateRegion":
      return mapQuestion(state, action.questionId, (question) => ({
        ...question,
        regions: asRegions(
          question.regions.map((region, index) =>
            index === action.regionIndex ? { ...region, box: action.box } : region,
          ),
        ),
      }));
    case "removeRegion":
      return mapQuestion(state, action.questionId, (question) =>
        question.regions.length <= 1
          ? question
          : {
              ...question,
              regions: asRegions(
                question.regions.filter((_, index) => index !== action.regionIndex),
              ),
            },
      );
    case "updateQuestion":
      return mapQuestion(state, action.questionId, (question) => {
        const next: BankQuestion = { ...question, ...action.patch };
        if (next.answer === "") delete next.answer;
        return next;
      });
    case "deleteQuestion":
      return {
        ...state,
        questions: state.questions.filter((question) => question.id !== action.questionId),
      };
    case "addMask":
      return mapMasks(state, action.pageIndex, (masks) => [...masks, action.box]);
    case "updateMask":
      return mapMasks(state, action.pageIndex, (masks) =>
        masks.map((mask, index) => (index === action.maskIndex ? action.box : mask)),
      );
    case "removeMask":
      return mapMasks(state, action.pageIndex, (masks) =>
        masks.filter((_, index) => index !== action.maskIndex),
      );
    case "renameSource":
      return { ...state, source: { ...state.source, title: action.title } };
  }
}

export function changeOf(action: CropEditorAction): EditorChange {
  switch (action.type) {
    case "createQuestion":
      return { kind: "upsert", id: action.question.id };
    case "appendRegion":
    case "updateRegion":
    case "removeRegion":
    case "updateQuestion":
      return { kind: "upsert", id: action.questionId };
    case "deleteQuestion":
      return { kind: "delete", id: action.questionId };
    case "addMask":
    case "updateMask":
    case "removeMask":
    case "renameSource":
      return { kind: "source" };
  }
}
