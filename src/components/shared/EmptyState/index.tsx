/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      <span className={styles.icon}>—</span>
      <span>{message}</span>
    </div>
  );
}