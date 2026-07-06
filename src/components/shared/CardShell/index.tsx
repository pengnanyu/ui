/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import type { ReactNode } from 'react';
import styles from './CardShell.module.css';

interface CardShellProps {
  title: ReactNode;
  titleExtra?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CardShell({ title, titleExtra, children, className }: CardShellProps) {
  return (
    <div className={`${styles.shell} ${className ?? ''}`}>
      <div className={styles.title}>
        <span className={styles.titleText}>{title}</span>
        {titleExtra && <span className={styles.titleExtra}>{titleExtra}</span>}
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
