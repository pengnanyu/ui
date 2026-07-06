/**
 * Copyright (c) 2024 深圳市德诚四方科技有限公司. All rights reserved.
 */
import styles from './LoadingSkeleton.module.css';

interface LoadingSkeletonProps {
  variant?: 'card' | 'list' | 'chart';
}

export function LoadingSkeleton({ variant = 'card' }: LoadingSkeletonProps) {
  const variantClass = {
    card: styles.card,
    list: styles.list,
    chart: styles.chart,
  }[variant];

  return <div className={`${styles.skeleton} ${variantClass}`} />;
}