type FestivalDefinition = {
  day?: number;
  month: number;
  name: string;
  prompt: string;
  resolveDay?: (year: number) => number;
  windowDays?: number;
};

function getNthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  nth: number,
) {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const offset = (weekday - firstDay.getUTCDay() + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function getLastWeekdayOfMonth(year: number, month: number, weekday: number) {
  const lastDay = new Date(Date.UTC(year, month, 0));
  const offset = (lastDay.getUTCDay() - weekday + 7) % 7;
  return lastDay.getUTCDate() - offset;
}

function getEasterSunday(year: number) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

const FESTIVALS: FestivalDefinition[] = [
  {
    month: 1,
    day: 1,
    name: 'New Year',
    prompt: '新年语境强调新的开始、焕新节奏与更自洽的状态感。',
    windowDays: 5,
  },
  {
    month: 2,
    day: 14,
    name: "Valentine's Day",
    prompt: '情人节语境强调悦己、精致感、亲密关系中的自我愉悦与细腻光彩。',
    windowDays: 5,
  },
  {
    month: 3,
    day: 8,
    name: "International Women's Day",
    prompt: '妇女节语境强调女性自我选择、自我欣赏与从容表达。',
    windowDays: 5,
  },
  {
    month: 4,
    name: 'Easter',
    resolveDay: (year) => getEasterSunday(year).day,
    prompt: '复活节语境强调焕新、轻盈、由内而外更新的感觉。',
    windowDays: 6,
  },
  {
    month: 5,
    name: "Mother's Day",
    resolveDay: (year) => getNthWeekdayOfMonth(year, 5, 0, 2),
    prompt: '母亲节语境强调温柔、细腻、成熟状态下的松弛与光泽感。',
    windowDays: 5,
  },
  {
    month: 6,
    name: "Father's Day",
    resolveDay: (year) => getNthWeekdayOfMonth(year, 6, 0, 3),
    prompt: '父亲节语境强调克制、得体与更利落清爽的精神面貌。',
    windowDays: 5,
  },
  {
    month: 10,
    day: 31,
    name: 'Halloween',
    prompt: '万圣节语境可轻微融入反差感、氛围感与夜间镜头下的轮廓美。',
    windowDays: 4,
  },
  {
    month: 11,
    day: 28,
    name: 'Thanksgiving',
    prompt: '感恩节语境强调对自己状态的珍视、温暖与丰盈感。',
    windowDays: 4,
  },
  {
    month: 12,
    day: 25,
    name: 'Christmas',
    prompt: '圣诞语境强调节日聚会、镜头表现、精致氛围与年末焕亮感。',
    windowDays: 7,
  },
];

function getFestivalDate(definition: FestivalDefinition, year: number) {
  return {
    year,
    month: definition.month,
    day: definition.resolveDay ? definition.resolveDay(year) : definition.day ?? 1,
  };
}

function toUtcDateValue(year: number, month: number, day: number) {
  return Date.UTC(year, month - 1, day);
}

export function buildFestivalPrompt(currentDate = new Date()) {
  const year = currentDate.getUTCFullYear();
  const todayValue = toUtcDateValue(
    year,
    currentDate.getUTCMonth() + 1,
    currentDate.getUTCDate(),
  );

  for (const definition of FESTIVALS) {
    const festival = getFestivalDate(definition, year);
    const festivalValue = toUtcDateValue(festival.year, festival.month, festival.day);
    const diffDays = Math.abs(Math.round((festivalValue - todayValue) / 86400000));

    if (diffDays <= (definition.windowDays ?? 3)) {
      const dateLabel = `${festival.year}-${String(festival.month).padStart(2, '0')}-${String(
        festival.day,
      ).padStart(2, '0')}`;

      return [
        `当前日期：${currentDate.toISOString().slice(0, 10)}`,
        `当前国际节日：${definition.name}（${dateLabel}）`,
        `节日语境要求：${definition.prompt}`,
        '请自然融入节日氛围，不要为了节日元素破坏专业调性。',
      ].join('\n');
    }
  }

  return [
    `当前日期：${currentDate.toISOString().slice(0, 10)}`,
    '当前无强相关国际节日语境。',
    '如果用户主动提到节日，再根据对应节日自然调整文案氛围。',
  ].join('\n');
}

