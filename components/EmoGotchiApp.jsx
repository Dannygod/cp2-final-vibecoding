"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  STORE_KEY,
  analyzeEmotion,
  assignedTasksFor,
  clamp,
  initialState,
  makeId,
  makeMonster,
  normalizeState,
  summarizeEntries
} from "../lib/emoGotchiCore";

function loadState() {
  if (typeof window === "undefined") return initialState();
  const raw = window.localStorage.getItem(STORE_KEY);
  if (!raw) return normalizeState(initialState());
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return normalizeState(initialState());
  }
}

export default function EmoGotchiApp({ page }) {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState(() => initialState());
  const [analysis, setAnalysis] = useState({ primaryEmotion: "neutral", emotionIntensity: 0 });
  const [reply, setReply] = useState("今天心情怎麼樣？我可以幫你把那些不想說出口的話吃掉。");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const loaded = loadState();
    const normalized = { ...loaded, tasks: assignedTasksFor(loaded.monster, loaded.tasks) };
    window.localStorage.setItem(STORE_KEY, JSON.stringify(normalized));
    setState(normalized);
    setMounted(true);
  }, []);

  function showToast(message) {
    setToast(message);
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => setToast(""), 3200);
  }

  function commit(updater, message) {
    setState((previous) => {
      const next = normalizeState(updater(structuredClone(previous)));
      window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
      return next;
    });
    if (message) showToast(message);
  }

  function submitEmotion(text) {
    const result = analyzeEmotion(text);
    setAnalysis(result);
    if (result.safetyFlag.level !== "none") {
      setReply("這聽起來已經超過小怪獸能單獨接住的範圍。請先聯絡身邊可信任的人，或立即尋求當地緊急協助。你不需要自己扛。");
      showToast("已觸發安全提醒，這次不進行怪獸化。");
      return;
    }

    commit((draft) => {
      const monster = draft.monster;
      if (result.isComfortingMonster) {
        monster.positiveEnergy = clamp(monster.positiveEnergy + 14);
        monster.negativeEnergy = clamp(monster.negativeEnergy - 10);
        monster.moodScore = clamp(monster.moodScore + 16, -100, 100);
      } else {
        monster.negativeEnergy = clamp(monster.negativeEnergy + result.emotionIntensity * 0.15);
        monster.moodScore = clamp(monster.moodScore - result.emotionIntensity * 0.1, -100, 100);
      }
      monster.baseColor = result.monsterChanges.baseColor;
      monster.expression = result.monsterChanges.expression;
      monster.aura = result.monsterChanges.aura;
      const accessory = result.monsterChanges.suggestedAccessory;
      monster.accessories[accessory.slot] = accessory.name;
      draft.entries.unshift({
        id: makeId(),
        text,
        primaryEmotion: result.primaryEmotion,
        primaryEmotionLabel: result.primaryEmotionLabel,
        intensity: result.emotionIntensity,
        createdAt: new Date().toISOString()
      });
      draft.tasks = assignedTasksFor(monster, draft.tasks);
      return draft;
    }, "小怪獸吃掉了這段情緒，外觀也更新了。");
    setReply(result.reply);
  }

  function refreshTasks() {
    commit((draft) => {
      draft.tasks = assignedTasksFor(draft.monster, draft.tasks, true);
      return draft;
    }, "已重新分配治癒任務。");
  }

  function completeTask(id) {
    commit((draft) => {
      const task = draft.tasks.find((item) => item.id === id);
      if (!task) return draft;
      task.status = "completed";
      draft.monster.positiveEnergy = clamp(draft.monster.positiveEnergy + task.reward);
      draft.monster.negativeEnergy = clamp(draft.monster.negativeEnergy - task.reward * 0.6);
      draft.monster.moodScore = clamp(draft.monster.moodScore + task.reward * 0.7, -100, 100);
      const rewards = [
        { slot: "head", name: "小太陽帽" },
        { slot: "face", name: "亮晶晶眼鏡" },
        { slot: "body", name: "勇氣披風" }
      ];
      const reward = rewards[Math.floor(Math.random() * rewards.length)];
      draft.monster.accessories[reward.slot] = reward.name;
      draft.tasks = assignedTasksFor(draft.monster, draft.tasks, true);
      return draft;
    }, "任務完成，小怪獸的正面值上升了。");
  }

  function abandonTask(id) {
    commit((draft) => {
      draft.tasks = draft.tasks.filter((task) => task.id !== id);
      draft.tasks = assignedTasksFor(draft.monster, draft.tasks, true);
      return draft;
    }, "已換掉這個任務。");
  }

  function createNewMonster(message = "新的小怪獸出生了。") {
    commit((draft) => {
      draft.monster = makeMonster();
      draft.entries = [];
      draft.tasks = assignedTasksFor(draft.monster, [], true);
      return draft;
    }, message);
    setReply("今天心情怎麼樣？我可以幫你把那些不想說出口的話吃掉。");
    setAnalysis({ primaryEmotion: "neutral", emotionIntensity: 0 });
  }

  function archiveMonster() {
    const hours = (Date.now() - new Date(state.monster.startedAt).getTime()) / 36e5;
    if (hours < 24 && state.entries.length < 2) {
      showToast("規格要求至少養一天；展示版可輸入兩次以上後封存。");
      return;
    }
    commit((draft) => {
      draft.diaries.unshift({
        id: makeId(),
        monster: structuredClone(draft.monster),
        summary: summarizeEntries(draft.entries),
        entryCount: draft.entries.length,
        startDate: draft.monster.startedAt,
        endDate: new Date().toISOString()
      });
      draft.monster = makeMonster();
      draft.entries = [];
      draft.tasks = assignedTasksFor(draft.monster, [], true);
      return draft;
    }, "已封存到日記，新的小怪獸出生了。");
  }

  function shareMonster() {
    commit((draft) => {
      const caption = draft.entries[0]
        ? `牠剛剛吞下了「${draft.entries[0].primaryEmotionLabel}」，現在配件是${Object.values(draft.monster.accessories).filter(Boolean).join("、") || "還沒長出來"}。`
        : "我的小怪獸今天還在觀察世界。";
      draft.posts.unshift({
        id: makeId(),
        anonymousName: `匿名飼主 ${String(Math.floor(Math.random() * 90 + 10))}`,
        color: draft.monster.baseColor,
        caption,
        likes: Math.floor(Math.random() * 20),
        comments: []
      });
      return draft;
    }, "已匿名分享到交流區。");
  }

  function addComment(postId, text) {
    commit((draft) => {
      const post = draft.posts.find((item) => item.id === postId);
      if (post && text.trim()) post.comments.push(text.trim());
      return draft;
    });
  }

  const routeProps = {
    state,
    analysis,
    reply,
    submitEmotion,
    refreshTasks,
    completeTask,
    abandonTask,
    createNewMonster,
    archiveMonster,
    shareMonster,
    addComment
  };

  if (!mounted) {
    return (
      <>
        <a className="skip-link" href="#main">跳到主要內容</a>
        <div className="app-shell">
          <Header page={page} />
          <main id="main" className="route-grid">
            <section className="route-intro loading-panel">
              <p className="eyebrow">Loading</p>
              <h2>正在喚醒小怪獸</h2>
              <p>讀取你的本機怪獸狀態與任務清單。</p>
            </section>
          </main>
        </div>
      </>
    );
  }

  return (
    <>
      <a className="skip-link" href="#main">跳到主要內容</a>
      <div className="app-shell">
        <Header page={page} />
        {page === "home" && <HomePage {...routeProps} />}
        {page === "tasks" && <TasksPage {...routeProps} />}
        {page === "diary" && <DiaryPage {...routeProps} />}
        {page === "community" && <CommunityPage {...routeProps} />}
      </div>
      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}

function Header({ page }) {
  const links = [
    { id: "home", href: "/", label: "首頁" },
    { id: "tasks", href: "/tasks", label: "任務" },
    { id: "diary", href: "/diary", label: "日記" },
    { id: "community", href: "/community", label: "交流區" }
  ];
  return (
    <header className="topbar" aria-label="主導覽">
      <Link className="brand-block brand-link" href="/">
        <div className="brand-mark" aria-hidden="true"><BrandIcon /></div>
        <div>
          <h1>Emo-gotchi</h1>
          <p>把今天吞不下的情緒，餵給你的發瘋小怪獸。</p>
        </div>
      </Link>
      <nav className="top-actions" aria-label="頁面">
        {links.map((link) => (
          <Link key={link.id} href={link.href} aria-current={page === link.id ? "page" : undefined}>{link.label}</Link>
        ))}
      </nav>
    </header>
  );
}

function HomePage(props) {
  return (
    <main id="main" className="dashboard home-route">
      <MonsterPanel {...props} />
      <EmotionPanel {...props} />
      <QuickTasks {...props} />
      <AccessoryPanel monster={props.state.monster} />
    </main>
  );
}

function TasksPage({ state, refreshTasks, completeTask, abandonTask }) {
  return (
    <main id="main" className="route-grid">
      <RouteIntro eyebrow="Healing tasks" title="治癒任務" copy="怪獸負面值超過 50% 時，任務會增加到 4 到 5 個。完成任務會提高正面值，並可能替怪獸換上新配件。" />
      <section className="tasks-panel route-panel" aria-labelledby="tasks-title">
        <div className="panel-heading compact">
          <div>
            <p className="eyebrow">Assigned now</p>
            <h2 id="tasks-title">目前任務</h2>
          </div>
          <button className="icon-button" type="button" aria-label="重新分配任務" onClick={refreshTasks}><RefreshIcon /></button>
        </div>
        <TaskList tasks={state.tasks} onComplete={completeTask} onAbandon={abandonTask} />
      </section>
      <MonsterSummary monster={state.monster} />
    </main>
  );
}

function DiaryPage({ state, archiveMonster }) {
  return (
    <main id="main" className="route-grid">
      <RouteIntro eyebrow="Diary" title="怪獸日記" copy="封存後會保留養育日期、情緒統計與怪獸最終樣貌。展示版輸入兩次後即可封存，正式版會要求至少養一天。" />
      <section className="diary-panel route-panel" aria-labelledby="diary-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Archive</p>
            <h2 id="diary-title">回顧列表</h2>
          </div>
          <button className="secondary-button" type="button" onClick={archiveMonster}><ArchiveIcon />封存目前怪獸</button>
        </div>
        <DiaryList diaries={state.diaries} />
      </section>
    </main>
  );
}

function CommunityPage({ state, shareMonster, addComment }) {
  return (
    <main id="main" className="route-grid">
      <RouteIntro eyebrow="Anonymous community" title="匿名交流區" copy="分享的是怪獸卡片與自動摘要，不預設公開原始情緒文字。這裡可以留言討論彼此養出的怪獸。" />
      <section className="community-panel route-panel" aria-labelledby="community-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Shared monsters</p>
            <h2 id="community-title">交流區貼文</h2>
          </div>
          <button className="secondary-button" type="button" onClick={shareMonster}><ShareIcon />分享怪獸</button>
        </div>
        <PostList posts={state.posts} onComment={addComment} />
      </section>
    </main>
  );
}

function MonsterPanel({ state, reply, archiveMonster }) {
  return (
    <section className="monster-panel" aria-labelledby="monster-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Current monster</p>
          <h2 id="monster-title">今日的小怪獸</h2>
        </div>
        <button className="icon-button" type="button" aria-label="封存目前怪獸" onClick={archiveMonster}><ArchiveIcon /></button>
      </div>
      <div className="monster-stage" aria-live="polite">
        <div className="speech-bubble">{reply}</div>
        <div className="monster-art" aria-label="目前怪獸外觀"><MonsterSvg monster={state.monster} /></div>
      </div>
      <MeterGrid monster={state.monster} />
    </section>
  );
}

function EmotionPanel({ analysis, submitEmotion, createNewMonster }) {
  const [text, setText] = useState("");
  function onSubmit(event) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    submitEmotion(value);
    setText("");
  }
  return (
    <section className="input-panel" aria-labelledby="input-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Feed emotion</p>
          <h2 id="input-title">想說些什麼......</h2>
        </div>
        <button className="quiet-button" type="button" onClick={() => createNewMonster()}>養新的</button>
      </div>
      <form className="emotion-form" onSubmit={onSubmit}>
        <label htmlFor="emotionText">今天發生的不如意、抱怨，或想哄小怪獸的話</label>
        <textarea id="emotionText" rows="6" maxLength="1000" required value={text} onChange={(event) => setText(event.target.value)} placeholder="例：今天在學校被老師罵，真的超生氣。" />
        <div className="form-row">
          <p>{text.length} / 1000</p>
          <button className="primary-button" type="submit"><SendIcon />餵食</button>
        </div>
      </form>
      <div className="analysis-panel">
        <p className="eyebrow">AI analysis JSON</p>
        <pre>{JSON.stringify(analysis, null, 2)}</pre>
      </div>
    </section>
  );
}

function QuickTasks({ state, completeTask, abandonTask }) {
  return (
    <section className="tasks-panel" aria-labelledby="quick-tasks-title">
      <div className="panel-heading compact">
        <div>
          <p className="eyebrow">Healing tasks</p>
          <h2 id="quick-tasks-title">治癒任務</h2>
        </div>
        <Link className="quiet-button link-button" href="/tasks">看全部</Link>
      </div>
      <TaskList tasks={state.tasks.slice(0, 2)} onComplete={completeTask} onAbandon={abandonTask} />
    </section>
  );
}

function RouteIntro({ eyebrow, title, copy }) {
  return (
    <section className="route-intro">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{copy}</p>
    </section>
  );
}

function MonsterSummary({ monster }) {
  return (
    <aside className="monster-summary">
      <div className="mini-monster large"><MonsterSvg monster={monster} compact /></div>
      <h2>目前狀態</h2>
      <MeterGrid monster={monster} />
      <AccessoryPanel monster={monster} />
    </aside>
  );
}

function MeterGrid({ monster }) {
  const moodLeft = clamp((monster.moodScore + 100) / 2, 0, 96);
  const moodLabel = monster.moodScore > 20 ? "偏好" : monster.moodScore < -20 ? "低落" : "中立";
  return (
    <div className="meter-grid" aria-label="怪獸狀態">
      <Meter label="負面值" value={`${Math.round(monster.negativeEnergy)}%`} width={monster.negativeEnergy} />
      <Meter label="正面值" value={`${Math.round(monster.positiveEnergy)}%`} width={monster.positiveEnergy} positive />
      <div className="meter-card">
        <div className="meter-label"><span>心情</span><strong>{moodLabel}</strong></div>
        <div className="mood-scale" aria-hidden="true"><span style={{ left: `${moodLeft}%` }} /></div>
      </div>
    </div>
  );
}

function Meter({ label, value, width, positive }) {
  return (
    <div className="meter-card">
      <div className="meter-label"><span>{label}</span><strong>{value}</strong></div>
      <div className={`meter-track ${positive ? "positive" : ""}`}><span style={{ width: `${width}%` }} /></div>
    </div>
  );
}

function TaskList({ tasks, onComplete, onAbandon }) {
  const assigned = tasks.filter((task) => task.status === "assigned");
  if (!assigned.length) return <p className="empty-state">目前沒有任務，重新分配後會出現新的治癒任務。</p>;
  return (
    <div className="task-list">
      {assigned.map((task) => (
        <article className="task-card" key={task.id}>
          <div>
            <h3>{task.title}</h3>
            <p>{task.description}</p>
          </div>
          <div className="task-actions">
            <button className="small-button complete" type="button" onClick={() => onComplete(task.id)}>完成</button>
            <button className="small-button abandon" type="button" onClick={() => onAbandon(task.id)}>放棄</button>
          </div>
        </article>
      ))}
    </div>
  );
}

function AccessoryPanel({ monster }) {
  const labels = { head: "頭飾", face: "臉部", body: "身體" };
  return (
    <section className="accessory-panel" aria-labelledby="accessory-title">
      <p className="eyebrow">Accessories</p>
      <h2 id="accessory-title">小怪獸配件</h2>
      <div className="accessory-grid">
        {Object.entries(labels).map(([slot, label]) => (
          <div className="accessory-item" key={slot}>
            <span className="slot-label">{label}</span>
            <h3>{monster.accessories[slot] || "尚未裝備"}</h3>
            <p>{monster.accessories[slot] ? "同部位會自動替換。" : "完成任務或輸入具象關鍵字可獲得。"}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DiaryList({ diaries }) {
  if (!diaries.length) return <p className="empty-state">封存怪獸後，這裡會出現養育日期、情緒統計與最終樣貌。</p>;
  return (
    <div className="diary-list">
      {diaries.map((diary) => (
        <article className="diary-card" key={diary.id}>
          <div className="mini-monster"><MonsterSvg monster={diary.monster} compact /></div>
          <h3>{formatDate(diary.startDate)} - {formatDate(diary.endDate)}</h3>
          <p>{diary.summary}</p>
          <p>{diary.entryCount} 則情緒紀錄</p>
        </article>
      ))}
    </div>
  );
}

function PostList({ posts, onComment }) {
  return <div className="post-list">{posts.map((post) => <PostCard post={post} onComment={onComment} key={post.id} />)}</div>;
}

function PostCard({ post, onComment }) {
  const [comment, setComment] = useState("");
  function submit(event) {
    event.preventDefault();
    onComment(post.id, comment);
    setComment("");
  }
  return (
    <article className="post-card">
      <div className="mini-monster"><MonsterSvg monster={{ baseColor: post.color, expression: "neutral", aura: "calm", accessories: {} }} compact /></div>
      <h3>{post.anonymousName}</h3>
      <p>{post.caption}</p>
      <div className="post-meta"><span>{post.likes} 個同感</span><span>{post.comments.length} 則留言</span></div>
      <div className="comment-list">{post.comments.map((item, index) => <p key={`${post.id}-${index}`}>{item}</p>)}</div>
      <form className="comment-form" onSubmit={submit}>
        <input aria-label="匿名留言" placeholder="匿名留言" maxLength="80" value={comment} onChange={(event) => setComment(event.target.value)} />
        <button type="submit">送出</button>
      </form>
    </article>
  );
}

function MonsterSvg({ monster, compact = false }) {
  const accessories = monster.accessories || {};
  const eyeY = compact ? 48 : 103;
  const mouth = useMemo(() => {
    if (monster.expression === "comfort" || monster.expression === "soft smile") return <path d={`M92 ${compact ? 63 : 131}c13 10 30 10 43 0`} />;
    if (monster.expression === "sadness") return <path d={`M94 ${compact ? 66 : 136}c12-8 28-8 40 0`} />;
    return <path d={`M94 ${compact ? 65 : 134}c10 3 28 3 40 0`} />;
  }, [monster.expression, compact]);
  return (
    <svg viewBox="0 0 240 240" role="img" aria-label="小怪獸">
      <g className="monster-float">
        {monster.aura === "charged" && <path d="M37 83 23 71M202 83l15-12M42 170l-18 9M197 171l17 8" stroke={monster.baseColor} />}
        <path d="M75 66 58 28M165 66l17-38" />
        <path d="M62 112c0-45 26-75 58-75s58 30 58 75v34c0 38-23 59-58 59s-58-21-58-59v-34Z" className="monster-body" fill={monster.baseColor} />
        <path d="M79 79c-18 10-28 28-29 50" />
        <path d="M161 79c18 10 28 28 29 50" />
        <circle cx="99" cy={eyeY} r="7" fill="#17201c" />
        <circle cx="141" cy={eyeY} r="7" fill="#17201c" />
        {mouth}
        {accessories.head && <><path d="M91 42h58l-8-23H99Z" fill="#f7d66a" /><text x="120" y="37" textAnchor="middle" fontSize="13" fill="#17201c">{shortLabel(accessories.head)}</text></>}
        {accessories.face && <><rect x="86" y="87" width="68" height="28" rx="8" fill="rgba(255,255,255,.35)" /><path d="M86 101h68" /></>}
        {accessories.body && <><rect x="84" y="151" width="72" height="42" rx="8" fill="#fffaf0" /><text x="120" y="177" textAnchor="middle" fontSize="14" fill="#17201c">{shortLabel(accessories.body)}</text></>}
      </g>
    </svg>
  );
}

function shortLabel(text) {
  if (!text) return "";
  return text.replace("小怪獸", "").slice(0, 4);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric" }).format(new Date(date));
}

function BrandIcon() {
  return (
    <svg viewBox="0 0 32 32" role="img">
      <path d="M6 15c0-6 4.5-10 10-10s10 4 10 10v4c0 5.2-4 8-10 8S6 24.2 6 19v-4Z" />
      <path d="M10 7 7 2M22 7l3-5" />
      <circle cx="12.2" cy="15.5" r="1.6" />
      <circle cx="19.8" cy="15.5" r="1.6" />
      <path d="M12 21c2.6 1.5 5.4 1.5 8 0" />
    </svg>
  );
}

function SendIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4 20-7Z" /><path d="M22 2 11 13" /></svg>;
}

function RefreshIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /></svg>;
}

function ArchiveIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 8v13H3V8" /><path d="M1 3h22v5H1z" /><path d="M10 12h4" /></svg>;
}

function ShareIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4" /><path d="m8.6 13.5 6.8 4" /></svg>;
}
