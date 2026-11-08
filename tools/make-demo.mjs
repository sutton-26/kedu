import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/* 在脚本所在目录找 index.html，生成同目录的 kedu-demo.html */
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

const now = new Date();
const day = (offset) => {
  const d = new Date(now);
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
};
const key = (offset) => {
  const d = day(offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const iso = now.toISOString();
const T0 = key(0);
const T1 = key(-1);
const T2 = key(-2);
const T6 = key(-6);

/* 今天的事件只保留已经过去的时刻，避免出现"未来发生的事" */
const past = (h, m) => {
  const d = day(0);
  d.setHours(h, m, 0, 0);
  return d <= now;
};
const hhmm = (h, m) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
/* 归档时间：相对当前月份往前推，用来演示归档库的月/年划分 */
const archAt = (mOffset, dayNum, h = 21, m = 0) =>
  new Date(now.getFullYear(), now.getMonth() + mOffset, dayNum, h, m).toISOString();

const ev = (id, date, h, m, text, taskId = null, detail = '') =>
  ({ id, date, time: hhmm(h, m), text, taskId, at: iso, detail });

/* ---------------- 任务 ---------------- */
const tasks = [
  { id: 't1', title: '写毕业论文第三章', priority: 'urgent-important', dates: [T1, T0, key(2)], status: 'doing', createdAt: iso },
  { id: 't2', title: '改一遍初稿', priority: 'important-not-urgent', dates: [key(5)], status: 'todo', createdAt: iso },
  { id: 't3', title: '答辩', priority: 'important-not-urgent', dates: [key(20)], status: 'todo', createdAt: iso },
  { id: 't4', title: '定选题', priority: 'important-not-urgent', dates: [T6], status: 'done', createdAt: iso },
  { id: 't5', title: '读完开题文献', priority: 'important-not-urgent', dates: [T6], status: 'done', createdAt: iso },
  { id: 't6', title: '梳理个人网站的信息结构', priority: 'urgent-important', dates: [T1, T0], status: 'doing', createdAt: iso },
  { id: 't7', title: '重画首页线框', priority: 'important-not-urgent', dates: [key(1), key(2)], status: 'todo', createdAt: iso },
  { id: 't8', title: '回复合作方邮件', priority: 'urgent-not-important', dates: [T0], status: 'todo', createdAt: iso },
  { id: 't9', title: '预约下周体检', priority: 'urgent-not-important', dates: [key(4)], status: 'todo', createdAt: iso },
  { id: 't10', title: '整理下载目录', priority: 'not-urgent-not-important', dates: [], status: 'todo', createdAt: iso },
  { id: 't11', title: '准备英语六级', priority: 'not-urgent-not-important', dates: [], status: 'stopped', createdAt: iso },
  { id: 't12', title: '看完嵌入式与 AI 结合的那期视频', priority: 'important-not-urgent', dates: [key(12)], status: 'todo', createdAt: iso },

  /* 已归档：演示归档库的月/年划分（不在优先级矩阵里，但日历/链条/记录仍保留） */
  { id: 't13', title: '整理上学期课程笔记', priority: 'not-urgent-not-important', dates: [], status: 'done', createdAt: iso, archivedAt: archAt(-2, 12) },
  { id: 't14', title: '交开题报告', priority: 'important-not-urgent', dates: [key(-30)], status: 'done', createdAt: iso, archivedAt: archAt(-1, 20) },
  { id: 't15', title: '英语六级报名', priority: 'urgent-not-important', dates: [T6], status: 'done', createdAt: iso, archivedAt: archAt(-1, 6) },
  { id: 't16', title: '修好耳机', priority: 'not-urgent-not-important', dates: [T2], status: 'done', createdAt: iso, archivedAt: archAt(0, 7, 9, 40) },
  { id: 't17', title: '续借图书馆的书', priority: 'not-urgent-not-important', dates: [T0], status: 'done', createdAt: iso, archivedAt: archAt(0, 7, 15, 10) }
];

/* ---------------- 长期链 ---------------- */
const chains = [
  { id: 'c1', name: '毕业论文', taskIds: ['t4', 't5', 't1', 't2', 't3'] },
  { id: 'c2', name: '作品集', taskIds: ['t6', 't7'] },
  { id: 'c3', name: '英语六级', taskIds: [] }
];

/* ---------------- 短期链（今天，按作息） ---------------- */
const todayPlan = [
  [8, 10, '看昨天的记录', null, ''],
  [8, 25, '列今天要做的三件事', null, ''],
  [8, 40, '读第三章的参考文献', 't1', '第二节的样本量写得含糊，标出来待查。'],
  [9, 15, '卡在引用格式，先跳过', 't1', ''],
  [9, 45, '泡咖啡、刷手机', null, ''],
  [11, 20, '重写第三章导语', 't1', ''],
  [11, 55, '回复合作方邮件', 't8', '问了预算和交付时间，等他回。'],
  [12, 30, '列了 6 个页面，还差导航', 't6', ''],
  [12, 45, '午饭', null, '']
];
const todayEntries = todayPlan
  .filter(([h, m]) => past(h, m))
  .map(([h, m, text, taskId, detail], i) => ev(`e1${String(i).padStart(2, '0')}`, T0, h, m, text, taskId, detail));

/* ---------------- 短期链（昨天：有 3 小时以上断口） ---------------- */
const entries = [
  /* 昨天：两个任务排了期，胶囊会显示两个 */
  ev('e201', T1, 9, 30, '和导师开会，被说问题意识不清', 't1', '他说这是全书的关键，不是写作问题。我一直在解释章节安排，没回答"你到底要反驳谁"。'),
  ev('e202', T1, 10, 20, '记下导师的三条意见', 't1', ''),
  ev('e203', T1, 11, 0, '食堂吃饭，回来躺了一会儿', null, ''),
  ev('e204', T1, 13, 40, '看别人的个人网站找参考', 't6', ''),
  ev('e205', T1, 14, 30, '画首页草图', 't6', ''),
  ev('e206', T1, 16, 0, '去图书馆还书', null, ''),
  ev('e207', T1, 20, 10, '整理今天的笔记', null, ''),

  /* 前天：当天没有任何排期任务，胶囊行不出现，但历史记录仍在 */
  ev('e301', T2, 10, 0, '改第三章第二节', 't1', ''),
  ev('e302', T2, 12, 30, '午睡', null, ''),
  ev('e303', T2, 15, 40, '查引用格式规范', 't1', '国标和学校的模板不一致，先按国标。'),
  ev('e304', T2, 19, 0, '拖地、洗衣服', null, ''),

  /* 六天前：任务已完成；另有一条挂在不存在的任务上，测健壮性 */
  ev('e401', T6, 9, 0, '定选题', 't4', ''),
  ev('e402', T6, 14, 0, '读完最后一篇开题文献', 't5', ''),
  ev('e403', T6, 17, 30, '整理文献笔记（这条挂的是已删除的任务）', 't99', ''),
  ev('e404', T6, 21, 0, '散步', null, '')
].concat(todayEntries);

/* ---------------- 记录（每个任务每种类别最多一条） ---------------- */
const records = [
  { id: 'r1', taskId: 't1', at: iso, kind: 'progress', text: '第三章写到第二节，导语重写了一遍，比原来清楚。' },
  { id: 'r2', taskId: 't1', at: iso, kind: 'block', text: '引用格式卡了两天，决定先按国标写，最后统一改。' },
  { id: 'r3', taskId: 't1', at: iso, kind: 'gain', text: '问题意识不清——不是写作问题，是没想清楚要反驳谁。' },
  { id: 'r4', taskId: 't6', at: iso, kind: 'progress', text: '6 个页面定了，导航还没想好放哪。' },
  { id: 'r5', taskId: 't6', at: iso, kind: 'block', text: '导航放顶栏还是侧栏定不下来，取决于以后要不要加搜索。' },
  { id: 'r6', taskId: 't8', at: iso, kind: 'gain', text: '对方真正在意的是交付时间，不是预算。下次先报时间。' },
  { id: 'r7', taskId: 't9', at: iso, kind: 'progress', text: '体检约在周四上午，要空腹。' },
  { id: 'r8', taskId: 't11', at: iso, kind: 'gain', text: '虽然没过，但发现听力不是短板，是词汇量不够。单词计划留着。' },
  { id: 'r9', taskId: 't4', at: iso, kind: 'gain', text: '选题从"乡村振兴"缩到"县域电商"，范围一缩，材料就够用了。' },
  { id: 'r10', taskId: 't5', at: iso, kind: 'gain', text: '读文献最快的办法是先看结论和图表，再回头读方法。' }
];

const data = { tasks, chains, entries, records };

const marker = 'var D={tasks:[],chains:[],entries:[],records:[]};';
if (!html.includes(marker)) throw new Error('找不到数据占位，kedu.html 结构变了');

/* 数据指纹：演示数据变了就重置，没变则保留你在演示里的改动 */
const seed = createHash('sha1').update(JSON.stringify(data)).digest('hex').slice(0, 8);
data.seed = seed;

const boot =
  `var __old=null;try{var __r=localStorage.getItem(KEY);__old=__r?JSON.parse(__r).seed:null;}catch(e){}` +
  `if(__old===${JSON.stringify(seed)})load();else save();`;

const out = html
  .replace(marker, 'var D=' + JSON.stringify(data) + ';')
  .replace('load();', boot)
  .replace("var KEY='kedu.v2';", "var KEY='kedu.demo.v2';")
  .replace('<title>刻度</title>', '<title>刻度 · 模拟数据</title>');

writeFileSync(join(root, 'kedu-demo.html'), out);

const byDate = {};
entries.forEach((e) => { (byDate[e.date] = byDate[e.date] || []).push(e); });
console.log('kedu-demo.html 已生成', (out.length / 1024).toFixed(1) + 'KB');
console.log('任务', tasks.length, '链', chains.length, '记录', records.length);
console.log('链条事件', entries.length, '分布于', Object.keys(byDate).length, '天：');
Object.keys(byDate).sort().forEach((k) => console.log('  ', k, byDate[k].length, '条'));
console.log('今天保留到', todayEntries.length ? todayEntries[todayEntries.length - 1].time : '（无）');
