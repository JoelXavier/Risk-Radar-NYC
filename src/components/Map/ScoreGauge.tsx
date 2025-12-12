import styles from './ScoreGauge.module.css';

interface ScoreGaugeProps {
    score: number;
    size?: number;
}

export default function ScoreGauge({ score, size = 80 }: ScoreGaugeProps) {
    const radius = size / 2 - 4; // padding
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(Math.max(score, 0), 100);
    const offset = circumference - (progress / 100) * circumference;

    // Color logic
    let color = '#22c55e'; // default green
    if (score >= 80) color = '#ef4444'; // critical red
    else if (score >= 50) color = '#f97316'; // high orange
    else if (score >= 20) color = '#eab308'; // med yellow

    return (
        <div className={styles.gaugeContainer} style={{ width: size, height: size }}>
            <svg width={size} height={size} className={styles.svg}>
                <circle
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="8"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    stroke={color}
                    strokeWidth="8"
                    fill="transparent"
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className={styles.progressCircle}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
            </svg>
            <div className={styles.scoreText}>
                <span className={styles.value}>{score}</span>
            </div>
        </div>
    );
}
