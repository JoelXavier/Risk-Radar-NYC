import React from 'react';
import { X, ExternalLink, Mail, Linkedin, MapPin } from 'lucide-react';
import styles from './AboutModal.module.css';

interface AboutModalProps {
    onClose: () => void;
}

export function AboutModal({ onClose }: AboutModalProps) {
    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <button className={styles.closeButton} onClick={onClose}>
                    <X size={20} />
                </button>

                <div className={styles.profileHeader}>
                    <img
                        src="/images/joel_avatar.jpg"
                        alt="Joel X Guerrero"
                        className={styles.avatar}
                    />
                    <h2 className={styles.name}>Joel X Guerrero</h2>
                    <div className={styles.role}>UX Engineer & Community Advocate</div>
                </div>

                <div className={styles.section}>
                    <div className={styles.sectionTitle}>Mission</div>
                    <p className={styles.text}>
                        Risk Radar NYC was built to democratize access to critical housing safety data.
                        By aggregating violations, complaints, and eviction history, this tool empowers
                        tenants, advocates, and city officials to hold bad actors accountable.
                    </p>
                </div>

                <div className={styles.section}>
                    <div className={styles.sectionTitle}>The Creator</div>
                    <p className={styles.text}>
                        With a background in UX Engineering and civic advocacy, Joel combines design thinking
                        with technical execution to solve urban challenges. His work focuses on transforming
                        opaque government data into actionable intelligence for the Kingsbridge community and beyond.
                    </p>
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <a href="https://www.linkedin.com/in/joelxguerrero/" target="_blank" rel="noopener noreferrer" className={styles.link} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Linkedin size={14} /> LinkedIn Profile
                        </a>
                        <a href="https://www.riverdalepress.com/stories/colorful-courts-in-kingsbridge-park-could-come-soon,69225" target="_blank" rel="noopener noreferrer" className={styles.link} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={14} /> Community Work (Riverdale Press)
                        </a>
                    </div>
                </div>

                <div className={styles.section}>
                    <div className={styles.sectionTitle}>Data Sources</div>
                    <div className={styles.pillGrid}>
                        <span className={styles.pill}>NYC DOB Violations</span>
                        <span className={styles.pill}>HPD Complaints</span>
                        <span className={styles.pill}>311 Service Requests</span>
                        <span className={styles.pill}>PLUTO (Land Use)</span>
                        <span className={styles.pill}>NYC Marshals Evictions</span>
                    </div>
                </div>

                <a href="mailto:Joelxguerrero@gmail.com" className={styles.contactButton}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Mail size={18} /> Contact Joel
                    </div>
                </a>
            </div>
        </div>
    );
}
