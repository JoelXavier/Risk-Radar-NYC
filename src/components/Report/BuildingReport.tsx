import React, { forwardRef } from 'react';
import styles from './BuildingReport.module.css';

interface BuildingReportProps {
    building: any; // Using any for flexibility with GeoJSON props
}

export const BuildingReport = forwardRef<HTMLDivElement, BuildingReportProps>(({ building }, ref) => {
    if (!building) return null;

    // Parse Violations safely (reusing logic from RiskMap)
    let violations = building.recent_violations;
    if (typeof violations === 'string') {
        try {
            violations = JSON.parse(violations);
        } catch (e) {
            violations = [];
        }
    }
    // Deduplicate logic (reusing logic from RiskMap just in case raw data persisted)
    // Actually our recent data fetch does deduplication in backend script, so this should be clean.
    // But let's just use it as is.
    const recentActivity = Array.isArray(violations) ? violations.slice(0, 10) : [];

    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <div ref={ref} className={styles.reportContainer}>
            {/* Header */}
            <div className={styles.header}>
                <div>
                    <div className={styles.brand}>Risk Radar NYC</div>
                    <div className={styles.reportDate}>Building Safety Summary</div>
                </div>
                <div className={styles.reportDate}>{currentDate}</div>
            </div>

            {/* Address */}
            <div className={styles.section}>
                <div className={styles.mainAddress}>{building.addressLine1 || building.address}</div>
                <div className={styles.subAddress}>
                    {building.borough}, NY {building.zipcode}
                </div>
            </div>

            {/* Risk Score */}
            <div className={styles.section}>
                <div className={styles.riskScoreSection}>
                    <div>
                        <div className={styles.riskLabel}>Safety Risk Score</div>
                        <div style={{ fontSize: '14px', opacity: 0.8, marginTop: '4px' }}>
                            Higher scores indicate higher potential risk based on open violations.
                        </div>
                    </div>
                    <div className={styles.riskValue}>{Math.round(building.risk_score)}/100</div>
                </div>
            </div>

            {/* Property Details */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Property Details</div>
                <div className={styles.grid}>
                    <div className={styles.statBox}>
                        <div className={styles.statLabel}>Owner / Landlord</div>
                        <div className={styles.statValue}>{building.owner_name || "Unknown"}</div>
                    </div>
                    <div className={styles.statBox}>
                        <div className={styles.statLabel}>Year Built</div>
                        <div className={styles.statValue}>{building.construct_year || "N/A"}</div>
                    </div>
                    <div className={styles.statBox}>
                        <div className={styles.statLabel}>BIN (Building ID)</div>
                        <div className={styles.statValue}>{building.bin}</div>
                    </div>
                    <div className={styles.statBox}>
                        <div className={styles.statLabel}>Tax Lot (BBL)</div>
                        <div className={styles.statValue}>{building.bbl || "N/A"}</div>
                    </div>
                </div>
            </div>

            {/* Violation Counts */}
            <div className={styles.section}>
                <div className={styles.sectionTitle}>Violation Summary</div>
                <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    <div className={styles.statBox} style={{ textAlign: 'center' }}>
                        <div className={styles.statLabel}>DOB Violations</div>
                        <div className={styles.statValue} style={{ color: '#ef4444' }}>{building.dob_violation_count}</div>
                    </div>
                    <div className={styles.statBox} style={{ textAlign: 'center' }}>
                        <div className={styles.statLabel}>HPD Violations</div>
                        <div className={styles.statValue} style={{ color: '#f97316' }}>{building.hpd_violation_count}</div>
                    </div>
                    <div className={styles.statBox} style={{ textAlign: 'center' }}>
                        <div className={styles.statLabel}>311 Complaints</div>
                        <div className={styles.statValue} style={{ color: '#eab308' }}>{building.complaint_311_count}</div>
                    </div>
                </div>
            </div>

            {/* Recent Activity Table */}
            {recentActivity.length > 0 && (
                <div className={styles.section}>
                    <div className={styles.sectionTitle}>Recent Activity Log (Top 10)</div>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '15%' }}>Date</th>
                                <th style={{ width: '10%' }}>Source</th>
                                <th>Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recentActivity.map((v: any, i: number) => (
                                <tr key={i}>
                                    <td style={{ color: '#64748b' }}>{v.date}</td>
                                    <td>
                                        <span className={styles.sourceTag}>{v.source}</span>
                                    </td>
                                    <td style={{ fontWeight: 500 }}>{v.description}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Footer */}
            <div className={styles.footer}>
                Data sourced from NYC Open Data (DOB, HPD, 311). This report is for informational purposes only and does not constitute an official legal document.<br />
                Generated by Risk Radar NYC.
            </div>
        </div>
    );
});

BuildingReport.displayName = 'BuildingReport';
