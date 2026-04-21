import type { UIMessage } from 'ai';

export function getMessageText(message: UIMessage) {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n')
    .trim();
}

export function deriveThreadTitle(messages: UIMessage[]) {
  const firstAssistantMessage = messages.find(message => message.role === 'assistant');
  const assistantText = firstAssistantMessage ? getMessageText(firstAssistantMessage) : '';

  if (assistantText) {
    const assistantLines = assistantText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const explicitTitleLine = assistantLines.find(line =>
      /^(标题|標題)\s*[:：]/.test(line),
    );
    const normalizedExplicitTitle = explicitTitleLine?.replace(/^(标题|標題)\s*[:：]\s*/, '');

    if (normalizedExplicitTitle) {
      return normalizedExplicitTitle.length > 24
        ? `${normalizedExplicitTitle.slice(0, 24)}…`
        : normalizedExplicitTitle;
    }

    const firstMeaningfulAssistantLine = assistantLines.find(line => line.length >= 4);
    if (firstMeaningfulAssistantLine) {
      return firstMeaningfulAssistantLine.length > 24
        ? `${firstMeaningfulAssistantLine.slice(0, 24)}…`
        : firstMeaningfulAssistantLine;
    }
  }

  const firstUserMessage = messages.find(message => message.role === 'user');
  const firstUserLine = firstUserMessage
    ? getMessageText(firstUserMessage).split('\n')[0]?.trim()
    : '';

  if (!firstUserLine) return '未命名';
  return firstUserLine.length > 24 ? `${firstUserLine.slice(0, 24)}…` : firstUserLine;
}

export function getMessagesSignature(messages: UIMessage[]) {
  return messages
    .map(message => `${message.id}:${message.role}:${getMessageText(message)}`)
    .join('||');
}
