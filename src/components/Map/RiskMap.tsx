"use client";

import { useRef, useEffect, useState, useCallback } from 'react';
import Map, {
    NavigationControl,
    FullscreenControl,
    GeolocateControl,
    Layer,
    Source,
    MapRef
} from 'react-map-gl/maplibre';
import type { FillExtrusionLayerSpecification, HeatmapLayerSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, Loader2, HelpCircle, FileDown, Download } from 'lucide-react';
import styles from './RiskMap.module.css';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point } from '@turf/helpers';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { BuildingReport } from '../Report/BuildingReport';
import { AboutModal } from '../UI/AboutModal';

// Initial Viewport: NYC Data Center
const INITIAL_VIEW_STATE = {
    longitude: -73.96, // Centered better between Man/QS/BK/BX
    latitude: 40.75, // Mid-Manhattan latitude
    zoom: 11.5, // Zoom out to see more
    pitch: 45,
    bearing: 0
};

// Premium Dark Style (Carto)
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Dictionary for Tooltips
import { InfoTooltip as SharedTooltip } from '../UI/InfoTooltip';

// Wrapper to maintain existing styles
const InfoTooltip = ({ label }: { label: string }) => (
    <SharedTooltip
        label={label}
        className="infoIcon" // Targeted by global CSS rule in .detailItem
    />
);

interface RiskMapProps {
    onBuildingSelect?: (buildingId: string | null) => void;
}

import SearchBar from './SearchBar';

// Heatmap Layer Configuration
const heatmapLayer: HeatmapLayerSpecification = {
    id: 'risk-heatmap',
    type: 'heatmap',
    source: 'risk-points',
    maxzoom: 15, // Fade out as we zoom in closely to see buildings
    paint: {
        // Increase the heatmap weight based on frequency and property magnitude
        'heatmap-weight': [
            'interpolate',
            ['linear'],
            ['get', 'risk_score'],
            0, 0,
            100, 1
        ],
        // Increase the heatmap color weight weight by zoom level
        // heatmap-intensity is a multiplier on top of heatmap-weight
        'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11, 1,
            15, 3
        ],
        // Color ramp for heatmap.  Domain is 0 (low) to 1 (high).
        // Begin color ramp at 0-stop with a 0-transparency color
        // to create a blur-like effect.
        'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(33,102,172,0)',
            0.2, 'rgb(103,169,207)',
            0.4, 'rgb(209,229,240)',
            0.6, 'rgb(253,219,199)',
            0.8, 'rgb(239,138,98)',
            1, 'rgb(178,24,43)'
        ],
        // Adjust the heatmap radius by zoom level
        'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11, 15,
            15, 20
        ],
        // Transition from heatmap to circle layer by zoom level
        'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14, 1,
            15, 0 // Fade out completely at zoom 15
        ]
    }
};

import FilterControls from './FilterControls';
import ScoreGauge from './ScoreGauge';
import ViolationFilters from './ViolationFilters'; // Assuming this component exists

export default function RiskMap({ onBuildingSelect }: RiskMapProps) {
    const [loaded, setLoaded] = useState(false);
    const [data, setData] = useState<any>(null);
    const [pointsData, setPointsData] = useState<any>(null); // For Heatmap
    const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
    const [minRiskFilter, setMinRiskFilter] = useState(0);
    const [showAbout, setShowAbout] = useState(false);
    // Use ref to access map instance for flyTo
    const mapRef = useRef<MapRef>(null);

    // Filter State
    const [violationFilters, setViolationFilters] = useState({
        dob: true,
        hpd: true,
        threeOneOne: true
    });

    // Dynamic Filter Expression for MapBox Layer
    const getFilterExpression = () => {
        // Base: Risk Score Filter
        const riskExp = ['>=', 'risk_score', minRiskFilter];

        // If all filters are ON, we just show everything (standard view)
        // If all filters are OFF, we show nothing? Or just standard?
        // Let's assume OR logic for checked items: "Show building if (DOB checked & count>0) OR ..."

        const sourceFilters: any[] = [];
        if (violationFilters.dob) sourceFilters.push(['>', 'dob_violation_count', 0]);
        if (violationFilters.hpd) sourceFilters.push(['>', 'hpd_violation_count', 0]);
        if (violationFilters.threeOneOne) sourceFilters.push(['>', 'complaint_311_count', 0]);

        // Note: Our dataset is heavily DOB-based, so most buildings have DOB > 0.
        // If HPD is checked, we want to see HPD buildings.
        // If "HPD Only" is desired, user unchecks DOB/311. 
        // Then we show: (countHPD > 0).

        // If no filters checked, hide all?
        if (sourceFilters.length === 0) return ['==', 'risk_score', -1]; // Impossible score -> Hide all

        const sourceExp = ['any', ...sourceFilters];

        return ['all', riskExp, sourceExp];
    };

    // Update layer filter when state changes
    useEffect(() => {
        // This effect might not be needed if we pass expression directly to Layer
    }, [violationFilters, minRiskFilter]);

    // Add Map Style Customization Hook
    const onMapLoad = useCallback((e: any) => {
        const map = e.target;

        // Civic Intelligence Theme Overrides (Seamless Integration)
        // We override the default Carto colors to match our app's Slate/Navy palette
        if (map.getLayer('background')) {
            map.setPaintProperty('background', 'background-color', '#101726'); // Lighter Navy to reveal roads
        }
        if (map.getLayer('water')) {
            map.setPaintProperty('water', 'fill-color', '#1e293b'); // Dark Slate for contrast
        }
        // Optional: Tint roads/labels if needed, but background/water makes the biggest impact
    }, []);

    useEffect(() => {
        const loadAll = async () => {
            try {
                const buildRes = await fetch('/data/buildings.geojson');
                const buildJson = await buildRes.json();
                setData(buildJson);

                const pointRes = await fetch('/data/risk_points.geojson');
                const pointJson = await pointRes.json();
                setPointsData(pointJson);
            } catch (err) {
                console.error("Failed to load map data", err);
            } finally {
                setLoaded(true);
            }
        };
        loadAll();
    }, []);

    const [hoverInfo, setHoverInfo] = useState<{ feature: any, x: number, y: number } | null>(null);
    const reportRef = useRef<HTMLDivElement>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownloadReport = async () => {
        if (!reportRef.current || !selectedBuilding) return;
        setIsDownloading(true);
        try {
            // Wait a tick for render if just selected
            await new Promise(resolve => setTimeout(resolve, 100));

            const canvas = await html2canvas(reportRef.current, {
                scale: 1.5, // Slightly lower scale to reduce file size
                useCORS: true,
                backgroundColor: '#ffffff'
            } as any);

            // Use JPEG for better compression
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const finalWidth = pdfWidth;
            const finalHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'JPEG', 0, 0, finalWidth, finalHeight);

            const filename = selectedBuilding?.bin ? `risk-report-${selectedBuilding.bin}.pdf` : 'risk-report-nyc.pdf';
            pdf.save(filename);

        } catch (error) {
            console.error("Report generation failed:", error);
        } finally {
            setIsDownloading(false);
        }
    };

    // Filter Logic: MapLibre Filter Expression correctly typed
    const mapFilter = ['>=', ['get', 'risk_score'], minRiskFilter];

    const riskLayer: FillExtrusionLayerSpecification = {
        id: 'building-risk-extrusion',
        type: 'fill-extrusion',
        source: 'buildings-source',
        filter: mapFilter as any, // Cast to any or standard filter type if strict typing complains
        paint: {
            'fill-extrusion-color': [
                'interpolate',
                ['linear'],
                ['get', 'risk_score'],
                0, '#22c55e',
                20, '#eab308',
                50, '#f97316',
                100, '#ef4444'
            ],
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 0.9,
            'fill-extrusion-vertical-gradient': true
        }
    };

    // Highlight layer for hover effect (using line/outline at roof height)
    // Note: MapLibre doesn't easily support outlining specific 3D extrusions without duplication, 
    // but we can change opacity or color on hover. 
    // For now, let's use a simple state-based color change or just rely on the cursor.
    // Actually, let's add a "highlight" layer that only renders the hovered building.

    // We can use a filter to only show the hovered building in this layer
    const highlightLayer: FillExtrusionLayerSpecification = {
        id: 'building-highlight',
        type: 'fill-extrusion',
        source: 'buildings-source',
        paint: {
            'fill-extrusion-color': '#3b82f6', // Bright Blue highlight
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': 0,
            'fill-extrusion-opacity': 1,
            'fill-extrusion-vertical-gradient': false
        }
    };

    // Fly To Search Result
    const handleLocationSelect = useCallback((lng: number, lat: number) => {
        if (mapRef.current) {
            mapRef.current.flyTo({
                center: [lng, lat],
                zoom: 18,
                pitch: 50,
                duration: 2000,
                essential: true
            });

            // Find building at this location
            if (data && data.features) {
                // Simple distance check or point-in-polygon
                const targetPoint = point([lng, lat]);
                const match = data.features.find((f: any) => {
                    if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
                        return booleanPointInPolygon(targetPoint, f);
                    }
                    return false;
                });

                if (match) {
                    setSelectedBuilding(match.properties);
                    if (onBuildingSelect) onBuildingSelect(match.properties);
                } else {
                    // Reset if no building found directly there, user can click manually
                    setSelectedBuilding(null);
                }
            }
        }
    }, [data, onBuildingSelect]);

    return (
        <div className={styles.container}>

            {(!loaded || !data) && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.loadingContent}>
                        <Loader2 className={styles.spinner} />
                        <span className={styles.loadingText}>LOADING NYC DATA...</span>
                    </div>
                </div>
            )}

            {data && (
                <Map
                    ref={mapRef}
                    initialViewState={INITIAL_VIEW_STATE}
                    style={{ width: '100vw', height: '100vh' }}
                    mapStyle={MAP_STYLE}
                    onLoad={onMapLoad}
                    interactiveLayerIds={['building-risk-extrusion']}
                    onMouseLeave={() => setHoverInfo(null)}
                    onClick={(e) => {
                        const feature = e.features?.[0];
                        if (feature) {
                            setSelectedBuilding(feature.properties);
                            // Fly to building
                            e.target.flyTo({
                                center: e.lngLat,
                                zoom: 16,
                                pitch: 55,
                                duration: 1500,
                                essential: true
                            });
                        } else {
                            setSelectedBuilding(null);
                        }
                    }}
                >

                    <Source id="buildings-source" type="geojson" data={data}>
                        <Layer
                            {...riskLayer}
                            filter={getFilterExpression() as any}
                        />
                        {/* Hover Layer needs same filter to match visibility? */}
                        {hoverInfo && (
                            <Layer
                                {...highlightLayer}
                                filter={['all',
                                    ['==', 'bin', hoverInfo.feature.properties.bin],
                                    getFilterExpression() as any // Ensure we don't highlight hidden buildings
                                ] as any}
                            />
                        )}
                    </Source>
                    {/* Desktop Controls (Bottom Right) */}
                    <div className={styles.desktopControls}>
                        <NavigationControl position="bottom-right" showCompass={true} />
                        <FullscreenControl position="bottom-right" />
                        <GeolocateControl position="bottom-right" />
                    </div>


                    {/* Violation Filters (Desktop Only - Top Right) */}
                    <ViolationFilters
                        filters={violationFilters}
                        onChange={(key) => setViolationFilters(prev => ({ ...prev, [key]: !prev[key] }))}
                    />

                    {/* Mobile Floating Brand Header (Top Right) */}
                    <div className={styles.mobileBrandHeader}>
                        <div className={styles.iconBox} style={{ width: '32px', height: '32px' }}>
                            <Layers size={16} />
                        </div>
                        <div>
                            <h1 className={styles.title} style={{ fontSize: '1rem' }}>Risk Radar NYC</h1>
                        </div>
                    </div>
                </Map>
            )}

            {/* Decorative Overlays (Glassmorphism) */}

            {/* About Button (Top Center) */}
            <button
                onClick={() => setShowAbout(true)}
                style={{
                    position: 'absolute',
                    top: '24px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 45,
                    background: 'rgba(15, 23, 42, 0.8)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '20px',
                    padding: '8px 16px',
                    color: '#93c5fd', // Light blue text
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 0 15px rgba(59, 130, 246, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.95)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(15, 23, 42, 0.8)'}
            >
                <HelpCircle size={14} />
                About The Project
            </button>

            {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}

            <div className={`${styles.overlayPanel} ${selectedBuilding ? styles.expanded : ''}`}>
                <div className={styles.dragHandle} />

                {/* Desktop Header (Inside Panel) */}
                <div className={styles.desktopHeader}>
                    <div className={styles.iconBox}>
                        <Layers size={20} />
                    </div>
                    <div>
                        <h1 className={styles.title}>Risk Radar NYC</h1>
                        <p className={styles.subtitle}>Building Safety Intelligence</p>
                    </div>
                </div>
                <div className={styles.divider} />

                {/* Command Center Inputs - Always Visible */}
                <div style={{ padding: '0 24px 12px 24px' }}>
                    <SearchBar onLocationSelect={handleLocationSelect} />
                    <FilterControls minRisk={minRiskFilter} onMinRiskChange={setMinRiskFilter} />
                </div>
                <div className={styles.divider} />

                {!selectedBuilding && (
                    <div className={styles.legend}>
                        <div className={styles.legendHeader}>
                            <span>Low Risk</span>
                            <span>Critical</span>
                        </div>
                        <div className={styles.gradientBar}>
                            <div className={styles.barLow} />
                            <div className={styles.barMed} />
                            <div className={styles.barHigh} />
                        </div>
                        <div className={styles.stats}>
                            {data ? `${data.features.length} Buildings Monitored` : 'Initializing...'}
                        </div>
                    </div>
                )}

                {selectedBuilding && (
                    <div className={styles.detailsPanel}>

                        <div className={styles.addressHeader}>
                            <span className={styles.addressLine1}>{selectedBuilding.address}</span>
                            {selectedBuilding.borough && selectedBuilding.zipcode && (
                                <span className={styles.addressLine2}>{selectedBuilding.borough}, NY {selectedBuilding.zipcode}</span>
                            )}
                        </div>

                        <div className={styles.detailsGrid}>
                            <div className={styles.detailItem}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span className={styles.detailLabel}>BIN</span>
                                    <InfoTooltip label="BIN" />
                                </div>
                                <span className={styles.detailValue}>{selectedBuilding.bin}</span>
                            </div>
                            <div className={styles.detailItem}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span className={styles.detailLabel}>Owner</span>
                                    <InfoTooltip label="Owner" />
                                </div>
                                <span className={styles.detailValue} style={{ fontSize: '0.875rem' }}>
                                    {selectedBuilding.owner_name || 'Unknown'}
                                </span>
                            </div>
                            <div className={styles.detailItem}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span className={styles.detailLabel}>Year Built</span>
                                    <InfoTooltip label="Year Built" />
                                </div>
                                <span className={styles.detailValue}>
                                    {selectedBuilding.construct_year > 0 ? selectedBuilding.construct_year : 'N/A'}
                                </span>
                            </div>
                            <div className={styles.detailItem}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <span className={styles.detailLabel}>Zip Code</span>
                                    <InfoTooltip label="Postal code" />
                                </div>
                                <span className={styles.detailValue}>
                                    {selectedBuilding.zipcode || 'N/A'}
                                </span>
                            </div>
                        </div>

                        <div className={styles.scoreContainer}>
                            <div style={{ flex: 1 }}>
                                <div className={styles.scoreLabel}>Risk Level</div>
                                <div style={{
                                    fontSize: '1rem',
                                    fontWeight: '800',
                                    color: selectedBuilding.risk_score >= 80 ? '#ef4444' :
                                        selectedBuilding.risk_score >= 50 ? '#f97316' :
                                            selectedBuilding.risk_score >= 20 ? '#eab308' : '#22c55e',
                                    marginTop: '0.25rem'
                                }}>
                                    {selectedBuilding.risk_score >= 80 ? 'CRITICAL' :
                                        selectedBuilding.risk_score >= 50 ? 'HIGH' :
                                            selectedBuilding.risk_score >= 20 ? 'MODERATE' : 'LOW'}
                                </div>
                            </div>
                            <ScoreGauge score={selectedBuilding.risk_score} size={70} />
                        </div>

                        {/* Violation Summary */}
                        <div style={{ marginTop: '24px' }}>
                            <div className={styles.detailsTitle}>Violation Summary</div>
                            <div className={styles.detailsGrid}>
                                <div className={styles.detailItem}>
                                    <div className={styles.detailLabel}>
                                        DOB <InfoTooltip label="Department of Buildings violations (structural/safety)" />
                                    </div>
                                    <span className={styles.detailValue}>{selectedBuilding.dob_violation_count || 0}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <div className={styles.detailLabel}>
                                        HPD <InfoTooltip label="Housing Preservation & Development violations (maintenance/quality of life)" />
                                    </div>
                                    <span className={styles.detailValue}>{selectedBuilding.hpd_violation_count || 0}</span>

                                    {/* NEW: Criticality Badges */}
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                                        {(selectedBuilding.hpd_class_a > 0) && (
                                            <div title="Class A: Non-Hazardous" style={{ fontSize: '0.7rem', color: '#22c55e', border: '1px solid #22c55e', padding: '1px 4px', borderRadius: '4px' }}>
                                                A: {selectedBuilding.hpd_class_a}
                                            </div>
                                        )}
                                        {(selectedBuilding.hpd_class_b > 0) && (
                                            <div title="Class B: Hazardous" style={{ fontSize: '0.7rem', color: '#f59e0b', border: '1px solid #f59e0b', padding: '1px 4px', borderRadius: '4px' }}>
                                                B: {selectedBuilding.hpd_class_b}
                                            </div>
                                        )}
                                        {(selectedBuilding.hpd_class_c > 0) && (
                                            <div title="Class C: Immediately Hazardous" style={{ fontSize: '0.7rem', color: '#ef4444', border: '1px solid #ef4444', padding: '1px 4px', borderRadius: '4px' }}>
                                                C: {selectedBuilding.hpd_class_c}
                                            </div>
                                        )}
                                    </div>

                                </div>
                                <div className={styles.detailItem}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span className={styles.detailLabel}>311</span>
                                        <InfoTooltip label="311" />
                                    </div>
                                    <span className={styles.detailValue}>{selectedBuilding.complaint_311_count}</span>
                                </div>
                                <div className={styles.detailItem}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <span className={styles.detailLabel} style={{ color: (selectedBuilding.eviction_count > 0) ? '#f87171' : undefined }}>Evictions</span>
                                        <InfoTooltip label="Executed residential evictions (since 2023). Source: NYC Marshals." />
                                    </div>
                                    <span className={styles.detailValue} style={{ color: (selectedBuilding.eviction_count > 0) ? '#f87171' : undefined }}>
                                        {selectedBuilding.eviction_count || 0}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Resident Feedback Cloud (NLP Topics) */}
                        {(() => {
                            let topics = selectedBuilding.complaint_topics;
                            // Parse if it's a string (GeoJSON sometimes serializes objects)
                            if (typeof topics === 'string') {
                                try { topics = JSON.parse(topics); } catch (e) { topics = []; }
                            }

                            if (Array.isArray(topics) && topics.length > 0) {
                                return (
                                    <div style={{ marginTop: '24px' }}>
                                        <div className={styles.detailsTitle} style={{ marginBottom: '12px' }}>
                                            Resident Feedback <InfoTooltip label="Common keywords from tenant 311 complaints" />
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            {topics.map((t: any, i: number) => {
                                                // Severity Color Logic
                                                const severe = ["MOLD", "MICE", "ROACHES", "NO HEAT", "LEAD", "VERMIN"];
                                                const moderate = ["LEAK", "WATER", "PAINT", "PLUMBING", "SEWAGE", "UNSANITARY"];

                                                let bgColor = 'rgba(148, 163, 184, 0.2)'; // Default Grey
                                                let textColor = '#cbd5e1';
                                                let borderColor = 'rgba(148, 163, 184, 0.3)';

                                                if (severe.includes(t.topic)) {
                                                    bgColor = 'rgba(239, 68, 68, 0.2)'; // Red
                                                    textColor = '#fca5a5';
                                                    borderColor = 'rgba(239, 68, 68, 0.4)';
                                                } else if (moderate.includes(t.topic)) {
                                                    bgColor = 'rgba(234, 179, 8, 0.2)'; // Yellow/Orange
                                                    textColor = '#fde047';
                                                    borderColor = 'rgba(234, 179, 8, 0.4)';
                                                }

                                                return (
                                                    <div key={i} style={{
                                                        padding: '4px 8px',
                                                        borderRadius: '6px',
                                                        backgroundColor: bgColor,
                                                        border: `1px solid ${borderColor}`,
                                                        color: textColor,
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}>
                                                        <span>{t.topic}</span>
                                                        <span style={{ opacity: 0.7, fontSize: '0.7rem' }}>({t.count})</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        {(() => {
                            let violations = selectedBuilding.recent_violations;
                            if (typeof violations === 'string') {
                                try {
                                    violations = JSON.parse(violations);
                                } catch (e) {
                                    violations = [];
                                }
                            }

                            if (Array.isArray(violations) && violations.length > 0) {
                                return (
                                    <div className={styles.violationListContainer}>
                                        <div className={styles.detailsTitle} style={{ marginBottom: '0.75rem' }}>RECENT ACTIVITY</div>
                                        <div className={styles.violationList}>
                                            {violations.map((v: any, i: number) => (
                                                <div key={i} className={styles.violationItem}>
                                                    <div className={styles.violationHeader}>
                                                        <span className={styles.violationSource}>{v.source}</span>
                                                        <span className={styles.violationDate}>{v.date}</span>
                                                    </div>
                                                    <div className={styles.violationText}>{v.description}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

                        <div className={styles.disclaimer}>
                            Scoring accounts for immediate hazards (Class C) and structural risks. Old buildings (&gt;80y) with violations receive higher scrutiny.
                        </div>
                        <button
                            onClick={handleDownloadReport}
                            disabled={isDownloading}
                            style={{
                                marginTop: '1.5rem',
                                width: '100%',
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                background: isDownloading ? '#475569' : '#3b82f6',
                                color: 'white',
                                border: 'none',
                                fontWeight: 600,
                                cursor: isDownloading ? 'wait' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                transition: 'background 0.2s'
                            }}
                        >
                            {isDownloading ? <Loader2 className={styles.spinner} size={16} /> : <FileDown size={18} />}
                            {isDownloading ? 'Generating PDF...' : 'Download Official Report'}
                        </button>
                    </div>
                )}
            </div>

            {/* Hidden Report Component for Capture - Positioned safely off-screen to right */}
            <div style={{ position: 'fixed', top: 0, left: '200vw', width: '210mm', minHeight: '297mm' }}>
                <BuildingReport ref={reportRef} building={selectedBuilding} />
            </div>

        </div >
    );
}
