import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'public/data');
const INPUT_FILE = path.join(DATA_DIR, 'raw_data.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'buildings.geojson');

interface Violation {
    bin: string;
    [key: string]: any;
}

interface Footprint {
    bin: string;
    the_geom: {
        type: string;
        coordinates: any[];
    };
    heightroof?: string;
    cnstrct_yr?: string;
    [key: string]: any;
}

interface RawData {
    dob_violations: Violation[];
    hpd_violations: Violation[];
    footprints: Footprint[];
}

// Scoring Weights
const WEIGHTS = {
    HPD: {
        CLASS_C: 15, // Immediately Hazardous
        CLASS_B: 8,  // Hazardous
        CLASS_A: 3,  // Non-Hazardous
        DEFAULT: 2
    },
    DOB: {
        HIGH_SEVERITY: 25, // Structural/Construction/Elevator major
        DEFAULT: 10
    }
};

function calculateRiskScore(dobViolations: Violation[], hpdViolations: Violation[], age: number): number {
    let rawScore = 0;

    // HPD Scoring
    hpdViolations.forEach(v => {
        const cls = v.class;
        if (cls === 'C') rawScore += WEIGHTS.HPD.CLASS_C;
        else if (cls === 'B') rawScore += WEIGHTS.HPD.CLASS_B;
        else if (cls === 'A') rawScore += WEIGHTS.HPD.CLASS_A;
        else rawScore += WEIGHTS.HPD.DEFAULT;
    });

    // DOB Scoring
    dobViolations.forEach(v => {
        // E=Elevator, C=Construction, B=Boiler, UB=Unsafe Building (Potentially)
        const type = v.violation_type_code;

        // UB, C (Construction), LL11 (Facade) are typically high risk
        if (['UB', 'C', 'LL11'].includes(type)) {
            rawScore += WEIGHTS.DOB.HIGH_SEVERITY;
        } else {
            rawScore += WEIGHTS.DOB.DEFAULT;
        }
    });

    // Age Factor (Only applied if there are existing violations)
    if ((dobViolations.length + hpdViolations.length) > 0) {
        if (age > 80) rawScore += 10;
        else if (age > 50) rawScore += 5;
    }

    // Cap at 100 for percentage-like visualization
    return Math.min(100, rawScore);
}

function processData() {
    console.log("Processing Data to GeoJSON...");

    if (!fs.existsSync(INPUT_FILE)) {
        console.error("No raw_data.json found. Run fetch_data.ts first.");
        return;
    }

    const rawData: RawData = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    const { dob_violations = [], hpd_violations = [], three_one_one = [], footprints = [], pluto_data = [], hpd_registrations = [], hpd_contacts = [] } = rawData as any;

    const features = footprints.map((building: any) => {
        const bin = building.bin;
        const bbl = building.base_bbl; // 10 digit BBL usually

        // 1. PLUTO Owner (Baseline)
        const plutoRecord = pluto_data.find((p: any) => p.bbl == bbl); // Loose equality for string/number BBLs
        let ownerName = plutoRecord ? plutoRecord.ownername : "Unknown Owner";

        // 2. HPD Registration Logic (The "Truth")
        // Find links: BIN -> Registration ID -> Contacts
        const registrationLink = hpd_registrations.find((r: any) => r.bin === bin);
        if (registrationLink) {
            const regId = registrationLink.registrationid;
            const contacts = hpd_contacts.filter((c: any) => c.registrationid === regId);

            if (contacts.length > 0) {
                // Priority 1: Human (Head Officer, Individual Owner)
                const headOfficer = contacts.find((c: any) => c.type === 'HeadOfficer' || c.type === 'IndividualOwner');
                if (headOfficer && headOfficer.firstname && headOfficer.lastname) {
                    ownerName = `${headOfficer.firstname} ${headOfficer.lastname} (Reg)`; // Mark as verified
                }
                // Priority 2: Site Manager
                else {
                    const manager = contacts.find((c: any) => c.type === 'SiteManager');
                    if (manager && manager.firstname && manager.lastname) {
                        ownerName = `${manager.firstname} ${manager.lastname} (Mgr)`;
                    }
                    // Priority 3: Corporate Owner from HPD (often more specific than PLUTO)
                    else {
                        const corp = contacts.find((c: any) => c.type === 'CorporateOwner');
                        if (corp && corp.corporationname) {
                            ownerName = corp.corporationname;
                        }
                    }
                }
            }
        }

        // Match DOB Violations by BIN
        const buildingDobViolations = dob_violations.filter((v: any) => v.bin === bin);

        // Match HPD by BBL
        const buildingHpdViolations = hpd_violations.filter((v: any) => {
            if (!bbl) return false;
            const hpdBoro = v.boroid;
            const hpdBlock = v.block?.toString().padStart(5, '0');
            const hpdLot = v.lot?.toString().padStart(4, '0');
            if (hpdBoro && hpdBlock && hpdLot) {
                return `${hpdBoro}${hpdBlock}${hpdLot}` === bbl;
            }
            return false;
        });

        // Match 311 by BBL (if available) or Address/Bin?
        // 311 data usually has 'bbl' field or 'incident_address'. Not always populated.
        // Let's check a sample of 311 data to see if 'bbl' exists. 
        // 311 API has 'bbl' column.
        const building311Complaints = three_one_one.filter((c: any) => {
            return c.bbl && c.bbl === bbl;
        });

        // Calculate Age
        const yearBuilt = parseInt(building.cnstrct_yr || "0");
        const currentYear = new Date().getFullYear();
        const age = yearBuilt > 0 ? currentYear - yearBuilt : 0;

        // Robust Address Extraction
        let address = "Unknown Address";
        // 1. Try DOB Violations (Usually cleanest)
        const validDob = buildingDobViolations.find((v: any) => v.house_number && v.street && v.street.trim().length > 0);
        if (validDob) {
            address = `${validDob.house_number.trim()} ${validDob.street.trim()}`;
        }
        // 2. Try 311 Data (often has incident_address)
        else if (building311Complaints.length > 0) {
            const valid311 = building311Complaints.find((c: any) => c.incident_address && c.incident_address.trim().length > 0);
            if (valid311) address = valid311.incident_address.trim();
        }

        // Fallback
        if (address === "Unknown Address") {
            // Try to format BBL if no address found
            address = building.base_bbl ? `BBL: ${building.base_bbl}` : `BIN: ${bin}`;
        }

        // Calculate Score with 311
        // 311 Weight: 5 points per complaint?
        let riskScore = calculateRiskScore(buildingDobViolations, buildingHpdViolations, age);
        riskScore += Math.min(20, building311Complaints.length * 2); // Cap 311 contribution at 20 points
        riskScore = Math.min(100, riskScore);

        // Enhance Address with PLUTO data if available
        let zipcode = "";
        let borough = "";

        if (plutoRecord) {
            zipcode = plutoRecord.zipcode || "";
            // Map borough code to name
            // 1: MN, 2: BX, 3: BK, 4: QN, 5: SI
            // PLUTO uses 'borocode' usually
            const boroMap: any = { '1': 'New York', '2': 'Bronx', '3': 'Brooklyn', '4': 'Queens', '5': 'Staten Island' };
            // check if plutoRecord has borocode. Raw data view showed 'borocode'.
            if (plutoRecord.borocode) {
                borough = boroMap[plutoRecord.borocode.toString()] || "";
            }
        }

        // Fallback for borough from DOB violations if checking boro field
        if (!borough && buildingDobViolations.length > 0) {
            const boroMap: any = { '1': 'New York', '2': 'Bronx', '3': 'Brooklyn', '4': 'Queens', '5': 'Staten Island' };
            borough = boroMap[buildingDobViolations[0].boro] || "";
        }

        // Create Recent Violations Summary
        // 1. DOB Violations
        const recentDob = buildingDobViolations
            .sort((a: any, b: any) => (b.issue_date || "").localeCompare(a.issue_date || ""))
            .slice(0, 3)
            .map((v: any) => ({
                source: "DOB",
                date: v.issue_date ? `${v.issue_date.substring(0, 4)}-${v.issue_date.substring(4, 6)}-${v.issue_date.substring(6, 8)}` : "N/A",
                description: v.description ? v.description.replace(/^\(\d+\)/, '').trim() : "Violation"
            }));

        // 2. HPD Violations
        const recentHpd = buildingHpdViolations
            .sort((a: any, b: any) => (b.novissueddate || "").localeCompare(a.novissueddate || ""))
            .slice(0, 3)
            .map((v: any) => ({
                source: "HPD",
                date: v.novissueddate ? v.novissueddate.split('T')[0] : "N/A",
                description: v.novdescription ? v.novdescription.replace(/§\s*[\d-]+(\s*ADM CODE)?(\s*HMC)?[:]\s*/i, '').trim() : "Violation"
            }));

        // 3. 311 Complaints
        const recent311 = building311Complaints
            .sort((a: any, b: any) => (b.created_date || "").localeCompare(a.created_date || ""))
            .slice(0, 3)
            .map((c: any) => ({
                source: "311",
                date: c.created_date ? c.created_date.split('T')[0] : "N/A",
                description: `${c.complaint_type}: ${c.descriptor}`
            }));

        // Filter HPD Violations (1 year) - This seems to be a re-filtering or a new set of HPD violations
        // The instruction implies this is part of a new scoring logic, but the existing `buildingHpdViolations`
        // is already filtered by BBL. Assuming this is meant to be a separate count for the new properties.
        const hpdVios = hpd_violations.filter((v: any) => {
            if (!v.novissueddate) return false;
            // Match via BBL (Constructed) or BIN if HPD adds it later
            // HPD 'boroid' + 'block' + 'lot' = BBL
            // Ensure we handle numeric/string types safely
            const vBlock = v.block ? v.block.toString() : '';
            const vLot = v.lot ? v.lot.toString() : '';

            // Standard BBL is 10 chars: B(1) + Block(5) + Lot(4)
            const hpdBbl = `${v.boroid}${vBlock.padStart(5, '0')}${vLot.padStart(4, '0')}`;

            // Debugging first few matches
            // if (hpdBbl === bbl) console.log(`MATCH! HPD ${v.violationid} -> BBL ${bbl}`);

            return hpdBbl === bbl;
        });

        if (hpdVios.length > 0) {
            // console.log(`Building ${bin} has ${hpdVios.length} HPD Violations.`);
        }

        // 3. Classify Violations (A, B, C)
        let hpdA = 0; // Non-Hazardous
        let hpdB = 0; // Hazardous
        let hpdC = 0; // Immediately Hazardous
        let hpdI = 0; // Info/Other

        hpdVios.forEach((v: any) => {
            const cls = v.class;
            if (cls === 'A') hpdA++;
            else if (cls === 'B') hpdB++;
            else if (cls === 'C') hpdC++;
            else hpdI++;
        });

        // Combine and distinct, then SORT ALL by date
        let allRecentViolations = [...recentDob, ...recentHpd, ...recent311]
            .sort((a, b) => b.date.localeCompare(a.date));

        // Deduplicate: Remove items with same Date AND Description
        const seen = new Set();
        allRecentViolations = allRecentViolations.filter(v => {
            const key = `${v.date}-${v.description.substring(0, 20)}`; // check first 20 chars
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        allRecentViolations = allRecentViolations.slice(0, 8); // Keep top 8 most recent events overall

        // The instruction provided a new risk score calculation and property structure.
        // This replaces the previous riskScore calculation and property assignment.
        // 4. Calculate Risk Score (new logic from instruction)
        let newRiskScore = 0;
        // Base score from volume
        newRiskScore += (hpdC * 3);
        newRiskScore += (hpdB * 2);
        newRiskScore += (hpdA * 1);
        newRiskScore += (buildingDobViolations.length * 5); // DOB is serious
        newRiskScore += (building311Complaints.length * 0.5); // 311 are reports, not confirmed yet

        // Cap at 100
        newRiskScore = Math.min(newRiskScore, 100);

        // Age Penalty (Old buildings need more care)
        if (age > 80 && newRiskScore > 0) newRiskScore += 5;

        // Ensure 0-100
        newRiskScore = Math.min(Math.max(newRiskScore, 0), 100);

        return {
            type: "Feature",
            properties: {
                id: bin,
                bin: bin,
                risk_score: Math.round(newRiskScore), // Use the new risk score
                dob_violation_count: buildingDobViolations.length,
                hpd_violation_count: hpdVios.length, // Use hpdVios for this count as per new logic
                complaint_311_count: building311Complaints.length,
                height: parseFloat(building.heightroof || "10"),
                construct_year: yearBuilt,
                address: address,
                owner_name: ownerName,
                zipcode: zipcode,
                borough: borough,
                bbl: bbl,
                hpd_class_a: hpdA,
                hpd_class_b: hpdB,
                hpd_class_c: hpdC,
                hpd_class_i: hpdI,
                recent_violations: allRecentViolations
            },
            geometry: building.the_geom
        };
    });

    const geoJson = {
        type: "FeatureCollection",
        features: features
    };

    // Generate Centroids for Heatmap
    // Simple average of coordinates for the "Point"
    const pointFeatures = features.map(f => {
        const polyCoords = f.geometry.coordinates[0][0]; // Outer ring
        let sumX = 0, sumY = 0;
        polyCoords.forEach((c: number[]) => { sumX += c[0]; sumY += c[1]; });
        const centerX = sumX / polyCoords.length;
        const centerY = sumY / polyCoords.length;

        return {
            type: "Feature",
            properties: {
                risk_score: f.properties.risk_score,
                weight: f.properties.risk_score / 100 // Normalized 0-1 for heatmap weight
            },
            geometry: {
                type: "Point",
                coordinates: [centerX, centerY]
            }
        };
    });

    const pointGeoJson = {
        type: "FeatureCollection",
        features: pointFeatures
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(geoJson, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'risk_points.geojson'), JSON.stringify(pointGeoJson, null, 2));

    console.log(`Saved ${features.length} buildings to ${OUTPUT_FILE}`);
    console.log(`Saved ${pointFeatures.length} risk points to risk_points.geojson`);
}

processData();
