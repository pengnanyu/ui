/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
export function getLocalizedField(
  row: Record<string, unknown>,
  fieldBaseName: string,
  locale: 'zh' | 'en'
): string {
  const chinaseKey = `${fieldBaseName}_Chinase`;
  const englishKey = `${fieldBaseName}_English`;

  if (locale === 'zh') {
    return (row[chinaseKey] as string) || (row[englishKey] as string) || '';
  }
  return (row[englishKey] as string) || (row[chinaseKey] as string) || '';
}