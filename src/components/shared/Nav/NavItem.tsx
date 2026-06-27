import styles from './Nav.module.css';

interface NavItemProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function NavItem({ label, active, onClick }: NavItemProps) {
  return (
    <button
      className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}