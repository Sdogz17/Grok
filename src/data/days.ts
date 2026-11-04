/**
 * Study log. Append one object to DAYS to record a day.
 *
 * date     YYYY-MM-DD
 * count    Words for that day, shown on the calendar. This is the number you
 *          decide. It does not have to equal words.length.
 * summary  What the session was.
 * grammar  Phrases and notes. Use [] when there are none.
 * words    Pinyin with tone marks, plus a short meaning. No Chinese characters.
 *
 * GOAL is the daily target. A day at or above it is green. A day from 1 up to
 * the target is ochre. A missing day is empty.
 */
export type Word = { pinyin: string; meaning: string };
export type StudyDay = {
  date: string;
  count: number;
  summary: string;
  grammar: string[];
  words: Word[];
};

export const GOAL = 10;

export const DAYS: StudyDay[] = [
  {
    date: "2026-10-13",
    count: 45,
    summary: "About 45 words: 15 from an Alexander Wang video and about 30 from a business chat role-play about running a stock-trading company and leading marketing.",
    grammar: [
      "Add hěn before adjectives so they don't sound flat",
      "X yǐqián for 'before' in time, e.g. Wǒ kāi gōngsī yǐqián, wǒ chǎogǔ",
      "duì wǒ lái shuō goes at the start of the sentence",
      "Word order with duì: Wǒ duì yíngxiāo yǒu xìngqù",
      "Casual phrasing over formal: yǒu, not yōngyǒu",
    ],
    words: [
      { pinyin: "tóngyì", meaning: "agree" },
      { pinyin: "shōugòu", meaning: "acquire (a company)" },
      { pinyin: "zhuànqián", meaning: "make money" },
      { pinyin: "hái méiyǒu", meaning: "not yet" },
      { pinyin: "zhǎodào", meaning: "found" },
      { pinyin: "zhǎngdà", meaning: "grow up" },
      { pinyin: "jìnqī", meaning: "recently" },
      { pinyin: "chénggōng", meaning: "success" },
      { pinyin: "chéngjiù", meaning: "achievement" },
      { pinyin: "máng", meaning: "busy" },
      { pinyin: "qián", meaning: "before, in front" },
      { pinyin: "liànxí", meaning: "practice" },
      { pinyin: "biànchéng", meaning: "become" },
      { pinyin: "núlì vs nǔlì", meaning: "slave vs work hard" },
      { pinyin: "tiàoguò", meaning: "skip" },
      { pinyin: "zhòngyào", meaning: "important" },
      { pinyin: "màoyì", meaning: "trade (goods, import-export)" },
      { pinyin: "rúguǒ", meaning: "if" },
      { pinyin: "kěyǐ", meaning: "can" },
      { pinyin: "yíngxiāo", meaning: "marketing" },
      { pinyin: "xiàngmù", meaning: "project" },
      { pinyin: "qù", meaning: "go" },
      { pinyin: "shāngdiàn", meaning: "store" },
      { pinyin: "mǎi", meaning: "buy" },
      { pinyin: "lǎopó", meaning: "wife" },
      { pinyin: "zuì hǎo", meaning: "best" },
      { pinyin: "xūyào", meaning: "need" },
      { pinyin: "yào", meaning: "want, need (casual)" },
      { pinyin: "kěnéng", meaning: "might, maybe" },
      { pinyin: "duì wǒ lái shuō", meaning: "for me, in my opinion" },
      { pinyin: "jiāoyì", meaning: "trading (stocks)" },
      { pinyin: "gǔpiào", meaning: "stocks" },
      { pinyin: "chǎogǔ", meaning: "trade stocks (casual)" },
      { pinyin: "wǒmen", meaning: "we" },
      { pinyin: "jǐ diǎn", meaning: "what time" },
      { pinyin: "zǒu", meaning: "leave, go" },
      { pinyin: "xiànzài", meaning: "now" },
      { pinyin: "xiǎng", meaning: "want, think" },
      { pinyin: "ná / dào", meaning: "take in hand / arrive, to" },
      { pinyin: "ràng", meaning: "make, let" },
      { pinyin: "kāixīn", meaning: "happy" },
      { pinyin: "gōngsī", meaning: "company" },
      { pinyin: "bāng", meaning: "help" },
      { pinyin: "Zhōngguó", meaning: "China" },
      { pinyin: "Nǐ juéde ne? / zěnme yàng", meaning: "What do you think? / how about it" },
      { pinyin: "fùzé", meaning: "be in charge of" },
      { pinyin: "guǎn", meaning: "manage (casual)" },
      { pinyin: "xìngqù", meaning: "interest" },
      { pinyin: "yǐqián", meaning: "before (in time)" },
    ],
  },
  {
    date: "2026-10-14",
    count: 14,
    summary: "Talked about customizable AI agents and comparing ideas and brands.",
    grammar: [
      "kě works like -able: kě dìngzhì de",
      "gēn for 'with': Wǒ xiǎng gēn nǐ liáo liáo yíngxiāo",
      "Repeating a verb makes it softer: liáo liáo, kàn kàn",
    ],
    words: [
      { pinyin: "kě dìngzhì de", meaning: "customizable" },
      { pinyin: "dìngzhì", meaning: "customize" },
      { pinyin: "zhìnéngtǐ", meaning: "AI agent" },
      { pinyin: "wèi", meaning: "for" },
      { pinyin: "měi ge rén", meaning: "every person" },
      { pinyin: "yíyàng", meaning: "same" },
      { pinyin: "bù yíyàng", meaning: "different (casual)" },
      { pinyin: "bù tóng", meaning: "different (formal)" },
      { pinyin: "xiǎngfǎ", meaning: "way of thinking, idea" },
      { pinyin: "liǎng ge", meaning: "two of" },
      { pinyin: "pǐnpái", meaning: "brand" },
      { pinyin: "gēn", meaning: "with" },
      { pinyin: "liáo / liáo liáo", meaning: "chat" },
      { pinyin: "qù dào", meaning: "go to, get to (a place)" },
    ],
  },
  {
    date: "2026-10-15",
    count: 5,
    summary: "Mined vocab from a Mandarin product meeting about the trading app's sell-early feature, which became the master 100-word study list. Broke down tíqián mài chū and dìngdān.",
    grammar: ["Tone contrast: mài (sell, 4th tone) vs mǎi (buy, 3rd tone)"],
    words: [
      { pinyin: "tíqián mài chū", meaning: "sell early (tí = lift, qián = before; mài = sell, chū = out)" },
      { pinyin: "dìngdān", meaning: "order (dìng = place, dān = slip)" },
      { pinyin: "bú yòng", meaning: "no need to" },
      { pinyin: "wèile", meaning: "for, in order to" },
      { pinyin: "qíyú", meaning: "the rest" },
    ],
  },
  {
    date: "2026-10-16",
    count: 4,
    summary: "Everyday words for forgetting things, attention, and bad moments.",
    grammar: [],
    words: [
      { pinyin: "wàng", meaning: "forget" },
      { pinyin: "zāogāo", meaning: "terrible" },
      { pinyin: "zhùyìlì", meaning: "attention" },
      { pinyin: "dàshēng", meaning: "loud, loudly" },
    ],
  },
  {
    date: "2026-10-18",
    count: 6,
    summary: "The chǎn word family, tied to product work (a feature having a good effect).",
    grammar: ["chǎn for producing physical things vs chǎnshēng for producing a result or effect"],
    words: [
      { pinyin: "chǎn", meaning: "produce, yield" },
      { pinyin: "shēngchǎn", meaning: "manufacture" },
      { pinyin: "chǎnliàng", meaning: "output" },
      { pinyin: "chǎnshēng", meaning: "produce (a result or effect)" },
      { pinyin: "chǎnpǐn", meaning: "product" },
      { pinyin: "xiàoguǒ", meaning: "effect, result" },
    ],
  },
  {
    date: "2026-10-20",
    count: 5,
    summary: "Alternated work and everyday words, then started journaling in pinyin about how your environment shapes your productivity.",
    grammar: ["rúguǒ...jiù (if...then)", "méi bànfǎ (can't, casual)"],
    words: [
      { pinyin: "quánjú", meaning: "global (quán = whole, jú = scope)" },
      { pinyin: "luójí", meaning: "logic" },
      { pinyin: "huánjìng", meaning: "environment" },
      { pinyin: "xiàolǜ", meaning: "efficiency (yǒu xiàolǜ = productive)" },
      { pinyin: "yǐngxiǎng", meaning: "affect, influence" },
    ],
  },
  {
    date: "2026-11-01",
    count: 1,
    summary: "Asked about yìsi from 'Wǒ lǐjiě nǐ de yìsi'.",
    grammar: ["shénme yìsi (what do you mean)", "bù hǎo yìsi (sorry, excuse me)"],
    words: [{ pinyin: "yìsi", meaning: "meaning (yì = idea, sī = think)" }],
  },
  {
    date: "2026-11-02",
    count: 4,
    summary: "'How would you say' practice: showing something, ideas vs plans, and being clear. Built 'Wǒ yǒu yí ge zhǔyi, wǒmen qù chī fàn ba' and 'Wǒmen de jìhuà hěn míngquè'.",
    grammar: [
      "gěi nǐ kàn (casual 'show you') vs zhǎnshì (formal display)",
      "jìhuà (a laid-out plan) vs zhǔyi (a quick idea)",
      "míngquè (clear, explicit) vs qīngchu (everyday 'clear')",
      "ba for 'let's': wǒmen qù chī fàn ba",
      "yī becomes yí before ge: yí ge zhǔyi",
      "bú cuò (pretty good)",
    ],
    words: [
      { pinyin: "zhǎnshì", meaning: "showcase, display (casual: gěi nǐ kàn)" },
      { pinyin: "zhǔyi", meaning: "idea" },
      { pinyin: "jìhuà", meaning: "plan (vs zhǔyi, a quick idea)" },
      { pinyin: "míngquè", meaning: "clear, explicit (everyday: qīngchu)" },
    ],
  },
  {
    date: "2026-11-04",
    count: 1,
    summary: "Diary-style practice about losing weight, work direction and plans. Built 'Wǒ jiǎnféi le'.",
    grammar: [
      "zài + verb (currently doing) vs le (change or done): wǒ zài jiǎnféi vs wǒ jiǎnféi le",
      "verb + fǎ (way of doing): chīfǎ, zuòfǎ, shuōfǎ, xiǎngfǎ",
      "wǒ zài nǔlì + verb (working hard at)",
      "duì … hěn mǎnyì (satisfied with)",
    ],
    words: [
      { pinyin: "jiǎnféi", meaning: "lose weight, diet (neutral: jiǎn zhòng)" },
    ],
  },
  {
    date: "2026-11-05",
    count: 9,
    summary: "Talking about a deep chat with dad, then built 'Jīntiān wǎnshang wǒ (gēn) wǒ mā liáo de hěn jiǔ', 'Wǒ gēn wǒ péngyou liáo de hěn kāixīn' and 'Wǒ zài nǔlì jiǎnféi, suǒyǐ wǒ bù chī mǐfàn'.",
    grammar: [
      "verb + de + hěn + adjective (how it was done): liáo de hěn shēn, liáo de hěn jiǔ",
      "gēn [person] + verb (with someone); hé is the more formal alternative",
    ],
    words: [
      { pinyin: "jīntiān wǎnshang", meaning: "tonight (today evening)" },
      { pinyin: "liáo", meaning: "chat, talk (full form: liáotiān)" },
      { pinyin: "hěn jiǔ", meaning: "a long time" },
      { pinyin: "gēn", meaning: "with (gēn [person] + verb; formal: hé)" },
      { pinyin: "péngyou", meaning: "friend" },
      { pinyin: "kāixīn", meaning: "happy" },
      { pinyin: "nǔlì", meaning: "try hard (wǒ zài nǔlì + verb; quick try: shìshi)" },
      { pinyin: "suǒyǐ", meaning: "so, therefore" },
      { pinyin: "mǐfàn", meaning: "rice (as a meal)" },
    ],
  },
];
