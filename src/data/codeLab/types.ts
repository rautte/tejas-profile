// data/codeLab/types.ts

export type CodeSnippet = {
  title: string;
  lang: string;
  from: string;
  why: string;
  code: string;

  technology?: string[];
  domain?: string[];
  concepts?: string[];
};
