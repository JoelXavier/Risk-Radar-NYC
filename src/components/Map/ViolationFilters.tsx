import styles from './RiskMap.module.css';
import { InfoTooltip } from '../UI/InfoTooltip';

interface Props {
    filters: {
        dob: boolean;
        hpd: boolean;
        threeOneOne: boolean;
    };
    onChange: (key: 'dob' | 'hpd' | 'threeOneOne') => void;
}

export default function ViolationFilters({ filters, onChange }: Props) {
    return (
        <div className={styles.filterPanel}>
            <div className={styles.filterTitle}>
                Violation Sources
            </div>
            <div className={styles.checkboxGroup}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={filters.dob}
                        onChange={() => onChange('dob')}
                    />
                    <span className={styles.labelText}>DOB Violations</span>
                    <span className={styles.badge} style={{ borderColor: '#3b82f6', color: '#3b82f6' }}>D</span>
                </label>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={filters.hpd}
                        onChange={() => onChange('hpd')}
                    />
                    <span className={styles.labelText}>HPD Violations</span>
                    <span className={styles.badge} style={{ borderColor: '#f97316', color: '#f97316' }}>H</span>
                </label>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={filters.threeOneOne}
                        onChange={() => onChange('threeOneOne')}
                    />
                    <span className={styles.labelText}>311 Complaints</span>
                    <span className={styles.badge} style={{ borderColor: '#a855f7', color: '#a855f7' }}>3</span>
                </label>
            </div>
        </div>
    );
}
