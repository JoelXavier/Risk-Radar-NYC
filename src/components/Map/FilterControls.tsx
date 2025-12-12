import { Filter } from 'lucide-react';
import styles from './FilterControls.module.css';
import { InfoTooltip } from '../UI/InfoTooltip';

interface FilterControlsProps {
    minRisk: number;
    onMinRiskChange: (val: number) => void;
}

export default function FilterControls({ minRisk, onMinRiskChange }: FilterControlsProps) {
    return (
        <div className={styles.filterContainer} style={{ position: 'relative' }}>
            <div className={styles.header}>
                <Filter size={16} />
                <span>Filter Map</span>
            </div>

            <InfoTooltip
                label="FilterMap"
                style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    color: '#94a3b8'
                }}
            />

            <div className={styles.group}>
                <label className={styles.label}>Minimum Risk Score: {minRisk}</label>
                <input
                    type="range"
                    min="0"
                    max="80"
                    step="10"
                    value={minRisk}
                    onChange={(e) => onMinRiskChange(Number(e.target.value))}
                    className={styles.rangeInput}
                />
                <div className={styles.rangeLabels}>
                    <span>All</span>
                    <span>Mod</span>
                    <span>High</span>
                    <span>Crit</span>
                </div>
            </div>
        </div>
    );
}
