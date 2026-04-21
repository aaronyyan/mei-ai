export const CHAT_UI_THEME = {
  appBackground: '#f7f7f3',
  mainSurface: '#fcfcf9',
  sidebarSurface: '#efeee8',
  sidebarSoftSurface: '#e6e4dc',
  sidebarBorder: '#dfddd3',
  border: '#dcd9cf',
  textPrimary: '#171717',
  textSecondary: '#57534e',
  textTertiary: '#a8a29e',
  textOnDark: '#ffffff',
  accent: '#171717',
  accentHover: '#2a2a2a',
  accentSoft: '#eceae1',
} as const;

export const CHAT_UI_COPY = {
  appName: 'Mei AI',
  composerPlaceholder: '给 Mei AI 发送消息',
  sendLabel: '发送',
  stopLabel: '停止',
  loadingLabel: '正在思考',
} as const;

export function buildThreadMetaLabel(updatedAt: number, now = Date.now()) {
  const currentDate = new Date(now);
  const targetDate = new Date(updatedAt);

  const isSameDay =
    currentDate.getFullYear() === targetDate.getFullYear() &&
    currentDate.getMonth() === targetDate.getMonth() &&
    currentDate.getDate() === targetDate.getDate();

  if (isSameDay) return '今天';
  return `${targetDate.getMonth() + 1}月${targetDate.getDate()}日`;
}
