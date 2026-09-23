export type BenefitType =
  | "Finansiell nytta 💰"
  | "Omfördelningsnytta ↺"
  | "Kvalitativ nytta 🖤"
  | "Miljönytta ♻️";
export type Beneficiary = "Intern nytta" | "Extern nytta";
export type CostType =
  | "Löpande driftkostnader (årligen återkommande)"
  | "Engångskostnad";
export type StaffBenefitType = "Finansiell nytta 💰" | "Omfördelningsnytta ↺";
export type Rank =
  | "1: Viktigaste nyttan"
  | "2: Näst viktigaste nyttan"
  | "3: Tredje viktigaste nyttan"
  | "";

export interface Benefit {
  change: string;
  effect: string;
  benefit: string;
  stakeholder: string;
  type: BenefitType | "";
  gynnas: Beneficiary | "";
  mal: string;
  rank: Rank;
}

export interface CostItem {
  name: string;
  type: CostType;
  costPerYear: number;
  startYear: number | null;
  margin: number;
  source: string;
}

export interface StaffToday {
  role: string;
  salary: number;
  hours: number;
  /** Antal personer med denna roll (standard 1). */
  count: number;
  desc: string;
}

export interface StaffChange extends Omit<StaffToday, "desc"> {
  benefitType: StaffBenefitType;
  desc: string;
}

export interface CostSheet<TStaff> {
  items: CostItem[];
  staff: TStaff[];
  growth: number;
}

export interface Revision {
  by: string;
  desc: string;
  version: string;
  date: string;
}

export interface FollowUp {
  effektmal: string;
  syfte: string;
  nar: string;
  hur: string;
  vad: string;
  ansvarig: string;
  resultat: string;
  atgard: string;
}

export type SurveyQuestionType = "flerval" | "skala" | "fritext";

export interface SurveyQuestion {
  id: string;
  question: string;
  questionType: SurveyQuestionType;
  options?: string[] | undefined;
  /** Sätts av AI:n, tas bort när användaren redigerar frågan manuellt. */
  ai?: boolean | undefined;
}

export interface Survey {
  title: string;
  intro: string;
  targetGroup: string;
  questions: SurveyQuestion[];
}

export const SURVEY_QUESTION_TYPES: SurveyQuestionType[] = [
  "flerval",
  "skala",
  "fritext",
];

export const SURVEY_QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  flerval: "Flerval",
  skala: "Skala",
  fritext: "Fritext",
};

export type QuestionResult =
  | {
      kind: "scale";
      qi: number;
      header: string | null;
      distribution: Record<string, number>;
      average: number | null;
      responses: number;
    }
  | {
      kind: "choice";
      qi: number;
      header: string | null;
      counts: { option: string; count: number }[];
      responses: number;
    }
  | {
      kind: "open";
      qi: number;
      header: string | null;
      answers: string[];
      responses: number;
    };

export interface SurveyResult {
  fileName: string;
  importedAt: string;
  responseCount: number;
  /** Signatur över enkätens frågor vid importen — används för att upptäcka ändringar. */
  signature: string;
  perQuestion: QuestionResult[];
}

export function surveySignature(survey: Survey): string {
  return survey.questions
    .map((q) => `${q.questionType}::${q.question.trim()}`)
    .join("||");
}


export interface AppState {
  project: {
    name: string;
    alt1: string;
    alt2: string;
    startYear: number;
    benefits: Benefit[];
    stakeholders: string;
    revisions: Revision[];
  };
  costToday: CostSheet<StaffToday>;
  costChange: CostSheet<StaffChange>;
  qualRatings: Record<number, { current: number; expected: number }>;
  reallocationInGraph: boolean;
  followUp: Record<number, FollowUp>;
  surveys: Record<number, Survey>;
  surveyResults: Record<number, SurveyResult>;

}


export const FULL_TIME_HOURS = 1760;
export const PO_FACTOR = 1.4024;
export const DISCOUNT_RATE = 0.03;
export const N_YEARS = 6;

export const BENEFIT_TYPES: BenefitType[] = [
  "Finansiell nytta 💰",
  "Omfördelningsnytta ↺",
  "Kvalitativ nytta 🖤",
  "Miljönytta ♻️",
];
export const BENEFICIARY: Beneficiary[] = ["Intern nytta", "Extern nytta"];
export const COST_TYPES: CostType[] = [
  "Löpande driftkostnader (årligen återkommande)",
  "Engångskostnad",
];
export const STAFF_BENEFIT_TYPES: StaffBenefitType[] = [
  "Finansiell nytta 💰",
  "Omfördelningsnytta ↺",
];
export const RANK_OPTIONS: Rank[] = [
  "1: Viktigaste nyttan",
  "2: Näst viktigaste nyttan",
  "3: Tredje viktigaste nyttan",
];

export const ROLE_SALARIES: Record<string, number | null> = {
  "Övrig personalresurs": null,
  Undersköterska: 32000,
  Sjuksköterska: 41500,
  Lärare: 42000,
  Stödassistent: 32000,
  Barnskötare: 30000,
  Måltidsbiträde: 29000,
  Systemförvaltare: 42000,
  Enhetschef: 54000,
  "Projekt-/utvecklingsledare": 51000,
  Ekonom: 42500,
};

export const ROLE_NAMES = Object.keys(ROLE_SALARIES);

export const QUALITATIVE_TYPES: BenefitType[] = [
  "Kvalitativ nytta 🖤",
  "Miljönytta ♻️",
];

export function emptyBenefit(): Benefit {
  return {
    change: "",
    effect: "",
    benefit: "",
    stakeholder: "",
    type: "",
    gynnas: "",
    mal: "",
    rank: "",
  };
}

export function emptyCostItem(startYear: number): CostItem {
  return {
    name: "",
    type: "Löpande driftkostnader (årligen återkommande)",
    costPerYear: 0,
    startYear,
    margin: 10,
    source: "",
  };
}

export function emptyStaffToday(): StaffToday {
  return {
    role: "Övrig personalresurs",
    salary: 0,
    hours: FULL_TIME_HOURS,
    count: 1,
    desc: "",
  };
}

export function emptyStaffChange(): StaffChange {
  return {
    role: "Övrig personalresurs",
    salary: 0,
    hours: FULL_TIME_HOURS,
    count: 1,
    benefitType: "Omfördelningsnytta ↺",
    desc: "",
  };
}

export function emptyFollowUp(): FollowUp {
  return {
    effektmal: "",
    syfte: "",
    nar: "",
    hur: "",
    vad: "",
    ansvarig: "",
    resultat: "",
    atgard: "",
  };
}

export function initialState(): AppState {
  const year = new Date().getFullYear();
  return {
    project: {
      name: "",
      alt1: "",
      alt2: "",
      startYear: year,
      benefits: [],
      stakeholders: "",
      revisions: [],
    },
    costToday: { items: [], staff: [], growth: 2 },
    costChange: { items: [], staff: [], growth: 2 },
    qualRatings: {},
    reallocationInGraph: false,
    followUp: {},
    surveys: {},
    surveyResults: {},


  };
}

export function benefitSentence(b: Benefit): string {
  const parts = [
    b.change && `Genom att ${b.change}`,
    b.effect && b.effect,
    b.benefit && `vilket leder till ${b.benefit}`,
    b.stakeholder && `för ${b.stakeholder}`,
  ].filter(Boolean);
  return parts.join(" ");
}
