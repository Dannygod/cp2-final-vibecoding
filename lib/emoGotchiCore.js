export const STORE_KEY = "emoGotchiMvpState";

export const taskBank = [
  { title: "喝一杯喜歡的飲料", description: "在杯底找回一點點快樂。", reward: 18 },
  { title: "離開座位走三分鐘", description: "讓身體先替腦袋換氣。", reward: 14 },
  { title: "把桌面清出一小角", description: "只整理一個角落就好。", reward: 12 },
  { title: "傳一句話給信任的人", description: "不用完整解釋，只要讓自己被看見一點。", reward: 16 },
  { title: "聽完一首歌", description: "選一首現在最需要的歌，不跳過。", reward: 10 },
  { title: "洗把臉或泡杯熱水", description: "給身體一個重新開始的訊號。", reward: 12 },
  { title: "寫下三個關鍵字", description: "不用寫文章，只把卡住的事命名。", reward: 14 }
];

export const emotionRules = [
  { emotion: "anger", label: "生氣", color: "#e85d50", accessory: { slot: "head", name: "紅色小角" }, keywords: ["生氣", "氣", "罵", "爛", "煩", "怒", "討厭"] },
  { emotion: "sadness", label: "難過", color: "#617dd8", accessory: { slot: "face", name: "水滴貼紙" }, keywords: ["難過", "哭", "傷心", "失落", "委屈", "孤單"] },
  { emotion: "anxiety", label: "焦慮", color: "#f7d66a", accessory: { slot: "head", name: "閃電髮夾" }, keywords: ["焦慮", "緊張", "怕", "擔心", "來不及", "壓力"] },
  { emotion: "fatigue", label: "疲憊", color: "#8f9a94", accessory: { slot: "face", name: "厚重眼袋" }, keywords: ["累", "疲憊", "睏", "沒力", "好忙", "崩潰"] }
];

export const concreteRules = [
  { keyword: "學校", slot: "body", name: "學校背包", visualElement: "backpack" },
  { keyword: "老師", slot: "body", name: "筆記本吊飾", visualElement: "tiny notebook" },
  { keyword: "考試", slot: "head", name: "考卷帽", visualElement: "exam paper hat" },
  { keyword: "公司", slot: "body", name: "識別證", visualElement: "office badge" },
  { keyword: "朋友", slot: "face", name: "友情OK繃", visualElement: "bandage sticker" },
  { keyword: "雨", slot: "head", name: "小雨雲帽", visualElement: "rain cloud hat" }
];

export function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function makeMonster() {
  return {
    id: makeId(),
    name: "小躁躁",
    startedAt: new Date().toISOString(),
    moodScore: 0,
    negativeEnergy: 0,
    positiveEnergy: 20,
    baseColor: "#bfe7d4",
    expression: "neutral",
    aura: "calm",
    accessories: { head: null, face: null, body: null }
  };
}

export function initialState() {
  return {
    monster: makeMonster(),
    entries: [],
    tasks: [],
    diaries: [],
    posts: [
      {
        id: makeId(),
        anonymousName: "匿名飼主 07",
        color: "#617dd8",
        caption: "牠今天替我扛住了焦慮，頭上還長了一朵雨雲。",
        likes: 12,
        comments: ["這隻看起來很懂加班後的沉默。"]
      }
    ]
  };
}

export function normalizeState(value) {
  const fallback = initialState();
  const next = { ...fallback, ...value };
  next.monster = {
    ...makeMonster(),
    ...next.monster,
    accessories: { head: null, face: null, body: null, ...(next.monster?.accessories || {}) }
  };
  next.entries = next.entries || [];
  next.tasks = next.tasks || [];
  next.diaries = next.diaries || [];
  next.posts = next.posts || [];
  return next;
}

export function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

export function detectSafety(text) {
  const crisisWords = ["自殺", "死掉", "不想活", "殺人", "傷害"];
  const hit = crisisWords.find((word) => text.includes(word));
  if (!hit) return { level: "none", reason: null };
  return { level: "crisis", reason: `偵測到危機字詞：${hit}` };
}

export function analyzeEmotion(text) {
  const comforting = ["加油", "辛苦", "沒事", "你可以", "謝謝", "抱抱", "乖"].some((keyword) => text.includes(keyword));
  const matched = emotionRules
    .map((rule) => ({ ...rule, score: rule.keywords.filter((keyword) => text.includes(keyword)).length }))
    .sort((a, b) => b.score - a.score)[0];
  const rule = matched && matched.score > 0 ? matched : emotionRules[0];
  const concretes = concreteRules.filter((item) => text.includes(item.keyword));
  const intensity = comforting
    ? 22
    : clamp(42 + rule.keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? 12 : 0), 0) + Math.min(text.length / 18, 28));
  const accessory = concretes[0] || rule.accessory;

  return {
    primaryEmotion: comforting ? "comfort" : rule.emotion,
    primaryEmotionLabel: comforting ? "安撫" : rule.label,
    secondaryEmotions: comforting ? ["relief"] : ["frustration"],
    emotionIntensity: Math.round(intensity),
    sentimentScore: comforting ? 38 : -Math.round(intensity * 0.82),
    isComfortingMonster: comforting,
    concreteKeywords: concretes.map((item) => ({ text: item.keyword, category: "object", visualElement: item.visualElement })),
    monsterChanges: {
      baseColor: comforting ? "#bfe7d4" : rule.color,
      expression: comforting ? "soft smile" : rule.emotion,
      aura: comforting ? "sparkle" : "charged",
      suggestedAccessory: {
        slot: accessory.slot,
        name: accessory.name,
        reason: concretes[0] ? `使用者提到${concretes[0].keyword}` : `偵測到${rule.label}情緒`
      }
    },
    reply: comforting
      ? "小怪獸聽到了，你正在把牠從壞心情裡拉回來。這句話也可以留一點給自己。"
      : makeReply(rule.emotion, accessory.name),
    imagePrompt: `Cute chaotic emotional monster, ${comforting ? "mint color and soft smile" : `${rule.color} body and ${rule.label} expression`}, wearing ${accessory.name}, digital pet style.`,
    safetyFlag: detectSafety(text)
  };
}

function makeReply(emotion, accessoryName) {
  const replies = {
    anger: `這口氣先交給小怪獸吞掉。牠長出了${accessoryName}，看起來比你還想替你抱不平。`,
    sadness: "聽起來真的很委屈。小怪獸把這段難過收進身上了，牠會陪你慢慢消化。",
    anxiety: "你現在像被很多事情追著跑。先讓小怪獸替你接住一部分，然後我們挑一個很小的任務開始。",
    fatigue: "今天的你已經撐很久了。小怪獸變得軟趴趴，但牠還在這裡跟你一起休息。"
  };
  return replies[emotion] || replies.anger;
}

export function assignedTasksFor(monster, currentTasks, force = false) {
  const targetCount = monster.negativeEnergy > 50 ? 5 : 2;
  const assigned = currentTasks.filter((task) => task.status === "assigned");
  if (!force && assigned.length >= targetCount) return currentTasks;
  return [...taskBank]
    .sort(() => Math.random() - 0.5)
    .slice(0, targetCount)
    .map((task) => ({ ...task, id: makeId(), status: "assigned" }));
}

export function summarizeEntries(entries) {
  const counts = entries.reduce((acc, entry) => {
    acc[entry.primaryEmotionLabel] = (acc[entry.primaryEmotionLabel] || 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? `最常出現：${top[0]}，共 ${top[1]} 次` : "尚無情緒紀錄";
}
