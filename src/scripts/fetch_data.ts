import fs from 'fs';
import path from 'path';

const API_ENDPOINTS = {
    DOB_VIOLATIONS: "https://data.cityofnewyork.us/resource/3h2n-5cm9.json",
    HPD_VIOLATIONS: "https://data.cityofnewyork.us/resource/wvxf-dwi5.json",
    BUILDING_FOOTPRINTS: "https://data.cityofnewyork.us/resource/5zhs-2jue.json",
    THREE_ONE_ONE: "https://data.cityofnewyork.us/resource/erm2-nwe9.json",
    MAP_PLUTO: "https://data.cityofnewyork.us/resource/64uk-42ks.json",
    HPD_REGS: "https://data.cityofnewyork.us/resource/tesw-yqqr.json",
    HPD_CONTACTS: "https://data.cityofnewyork.us/resource/feu5-w2e2.json",
    EVICTIONS: "https://data.cityofnewyork.us/resource/6z8x-wfk4.json"
};

const OUTPUT_DIR = path.join(process.cwd(), 'public/data');

async function fetchData() {
    console.log("Fetching NYC Open Data...");

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    try {
        // 2. Fetch HPD Violations (Scale up - Manhattan, Bronx, Brooklyn)
        console.log("Fetching HPD Violations...");
        // Filter for Manhattan (1), Bronx (2), Brooklyn (3)
        // Order by novissueddate DESC to get the most recent ones first
        const hpdRes = await fetch(`${API_ENDPOINTS.HPD_VIOLATIONS}?$limit=15000&$where=boroid IN ('1', '2', '3') AND currentstatus != 'VIOLATION CLOSED'&$order=novissueddate DESC`);
        const hpdData = await hpdRes.json();
        console.log(`Fetched ${Array.isArray(hpdData) ? hpdData.length : 0} HPD Violations.`);

        console.log("Fetching DOB Violations (Manhattan)...");
        const dobManhattan = await fetch(`${API_ENDPOINTS.DOB_VIOLATIONS}?$limit=4000&$where=boro = '1' AND violation_category IS NOT NULL AND bin != '0000000'&$order=issue_date DESC`);
        const dobManhattanData = await dobManhattan.json();

        console.log("Fetching DOB Violations (Bronx)...");
        const dobBronx = await fetch(`${API_ENDPOINTS.DOB_VIOLATIONS}?$limit=12000&$where=boro = '2' AND violation_category IS NOT NULL AND bin != '0000000'&$order=issue_date DESC`);
        const dobBronxData = await dobBronx.json();

        console.log("Fetching DOB Violations (Brooklyn)...");
        const dobBrooklyn = await fetch(`${API_ENDPOINTS.DOB_VIOLATIONS}?$limit=6000&$where=boro = '3' AND violation_category IS NOT NULL AND bin != '0000000'&$order=issue_date DESC`);
        const dobBrooklynData = await dobBrooklyn.json();

        const allDobData = [
            ...(Array.isArray(dobManhattanData) ? dobManhattanData : []),
            ...(Array.isArray(dobBronxData) ? dobBronxData : []),
            ...(Array.isArray(dobBrooklynData) ? dobBrooklynData : [])
        ];
        console.log(`Fetched Total ${allDobData.length} DOB Violations.`);

        // 2.5 Fetch 311 Service Requests
        console.log("Fetching 311 Service Requests...");
        const threeOneOneRes = await fetch(`${API_ENDPOINTS.THREE_ONE_ONE}?$limit=15000&$where=borough IN ('MANHATTAN', 'BRONX', 'BROOKLYN') AND created_date > '2023-01-01T00:00:00.000' AND complaint_type IN ('HEAT/HOT WATER', 'PAINT/PLASTER', 'PLUMBING', 'UNSANITARY CONDITION', 'WATER LEAK')`);
        const threeOneOneData = await threeOneOneRes.json();
        console.log(`Fetched ${Array.isArray(threeOneOneData) ? threeOneOneData.length : 0} 311 Complaints.`);

        // Merge datasets to find unique BINs
        // HPD data lacks BIN often, but has Block/Lot. We might need to fetch footprints by Block/Lot if BIN is missing?
        // Footprints dataset has 'bin', 'base_bbl'.
        // Construct BBL for HPD: 1 (Manhattan) + Block (5 digits) + Lot (4 digits).

        // Let's rely on DOB BINs for the geometry for now, as that's safer for 3D visualization.
        // If HPD records match a DOB BIN's BBL, we count them.

        const uniqueBinsFromDob = Array.from(new Set(
            allDobData.map((v: any) => v.bin).filter((b: string) => b && b.length === 7)
        ));
        console.log(`Found ${uniqueBinsFromDob.length} unique BINs from DOB data.`);

        // 3. Fetch Building Footprints (Batched)
        let footprints: any[] = [];
        if (uniqueBinsFromDob.length > 0) {
            console.log("Fetching Building Footprints...");

            // Aim for balanced distribution across 3 boroughs
            const manhattanBins = uniqueBinsFromDob.filter(b => b.startsWith('1')).slice(0, 2000);
            const bronxBins = uniqueBinsFromDob.filter(b => b.startsWith('2')).slice(0, 4500);
            const brooklynBins = uniqueBinsFromDob.filter(b => b.startsWith('3')).slice(0, 2000);

            const targetBins = [...manhattanBins, ...bronxBins, ...brooklynBins];
            console.log(`Fetching footprints for ${targetBins.length} buildings (${manhattanBins.length} MN, ${bronxBins.length} BX, ${brooklynBins.length} BK)...`);

            const chunkSize = 100;
            // Process in parallel chunks to speed up? Na. Single threaded promises for now is safer.
            for (let i = 0; i < targetBins.length; i += chunkSize) {
                const chunk = targetBins.slice(i, i + chunkSize);
                const binQuery = chunk.map(b => `'${b}'`).join(',');
                const url = `${API_ENDPOINTS.BUILDING_FOOTPRINTS}?$where=bin IN (${binQuery})`;

                try {
                    // console.log("Fetching: " + url);
                    const res = await fetch(url);
                    if (!res.ok) {
                        console.error(`Error fetching footprints: ${res.status} ${res.statusText}`);
                        const text = await res.text();
                        console.error("Response: " + text.substring(0, 200));
                        continue;
                    }
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        footprints = [...footprints, ...data];
                        if (footprints.length % 1000 === 0) process.stdout.write(`\n${footprints.length}`);
                        else process.stdout.write('.');
                    }
                } catch (err) {
                    console.error("Error fetching chunk:", err);
                }
            }
            console.log(`\nFetched ${footprints.length} Building Footprints.`);
        }

        // 4. Fetch PLUTO Data for Owner Names
        let plutoData: any[] = [];
        const validBbls = footprints
            .map((f: any) => f.base_bbl)
            .filter(bbl => bbl && bbl.length === 10);

        const uniqueBbls = Array.from(new Set(validBbls));

        if (uniqueBbls.length > 0) {
            console.log(`Fetching PLUTO data for ${uniqueBbls.length} buildings (Owner Info)...`);
            const chunkSize = 200; // URL length limits

            for (let i = 0; i < uniqueBbls.length; i += chunkSize) {
                const chunk = uniqueBbls.slice(i, i + chunkSize);
                // PLUTO BBL is usually a number or string, API expects string match
                const bblQuery = chunk.map(b => `'${b}'`).join(',');
                const url = `${API_ENDPOINTS.MAP_PLUTO}?$select=bbl,ownername,zipcode,borocode&$where=bbl IN (${bblQuery})`;

                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        plutoData = [...plutoData, ...data];
                        process.stdout.write('P'); // P for PLUTO
                    }
                } catch (err) {
                    console.error("Error fetching PLUTO chunk:", err);
                }
            }
            console.log(`\nFetched ${plutoData.length} PLUTO records.`);
        }

        // 5. Fetch HPD Registration Data (for Real Owner Names)
        let hpdRegistrations: any[] = [];
        let hpdContacts: any[] = [];

        const validBins = footprints.map((f: any) => f.bin).filter((bin: string) => bin && bin.length === 7);
        const uniqueBins = Array.from(new Set(validBins));

        if (uniqueBins.length > 0) {
            console.log(`Fetching HPD Registration Links for ${uniqueBins.length} buildings...`);
            const chunkSize = 200;

            // Step A: Get Registration IDs from BINs
            for (let i = 0; i < uniqueBins.length; i += chunkSize) {
                const chunk = uniqueBins.slice(i, i + chunkSize);
                const binQuery = chunk.map(b => `'${b}'`).join(',');
                const url = `${API_ENDPOINTS.HPD_REGS}?$select=bin,registrationid&$where=bin IN (${binQuery})`;

                try {
                    const res = await fetch(url);
                    const data = await res.json();
                    if (Array.isArray(data)) {
                        hpdRegistrations = [...hpdRegistrations, ...data];
                        process.stdout.write('R');
                    }
                } catch (err) { console.error("Error fetching Regs chunk:", err); }
            }
            console.log(`\nFound ${hpdRegistrations.length} Registration Links.`);

            // Step B: Get Contacts from Registration IDs
            const uniqueRegIds = Array.from(new Set(hpdRegistrations.map((r: any) => r.registrationid).filter((id: any) => id)));
            if (uniqueRegIds.length > 0) {
                console.log(`Fetching HPD Contacts for ${uniqueRegIds.length} registrations...`);
                for (let i = 0; i < uniqueRegIds.length; i += chunkSize) {
                    const chunk = uniqueRegIds.slice(i, i + chunkSize);
                    const regQuery = chunk.map(id => `'${id}'`).join(',');
                    // Fetch HeadOfficer, IndividualOwner, SiteManager, CorporateOwner
                    const url = `${API_ENDPOINTS.HPD_CONTACTS}?$where=registrationid IN (${regQuery})`;

                    try {
                        const res = await fetch(url);
                        const data = await res.json();
                        if (Array.isArray(data)) {
                            hpdContacts = [...hpdContacts, ...data];
                            process.stdout.write('C');
                        }
                    } catch (err) { console.error("Error fetching Contacts chunk:", err); }
                }
                console.log(`\nFetched ${hpdContacts.length} HPD Contacts.`);
            }
        }

        // 6. Fetch Residential Evictions (2023-Present)
        console.log("Fetching Eviction Data...");
        let evictions: any[] = [];
        try {
            const evictionsRes = await fetch(`${API_ENDPOINTS.EVICTIONS}?$limit=5000&$where=executed_date > '2023-01-01T00:00:00.000' AND residential_commercial_ind = 'Residential' AND borough IN ('MANHATTAN', 'BRONX', 'BROOKLYN')`);
            const evData = await evictionsRes.json();
            if (Array.isArray(evData)) {
                evictions = evData;
                console.log(`Fetched ${evictions.length} Evictions.`);
            }
        } catch (e) {
            console.error("Error fetching evictions:", e);
        }

        const output = {
            dob_violations: allDobData,
            hpd_violations: Array.isArray(hpdData) ? hpdData : [],
            three_one_one: Array.isArray(threeOneOneData) ? threeOneOneData : [],
            footprints: footprints,
            pluto_data: plutoData,
            hpd_registrations: hpdRegistrations,
            hpd_contacts: hpdContacts,
            evictions: evictions,
            generated_at: new Date().toISOString()
        };

        fs.writeFileSync(path.join(OUTPUT_DIR, 'raw_data.json'), JSON.stringify(output, null, 2));
        console.log(`Data saved to ${path.join(OUTPUT_DIR, 'raw_data.json')}`);

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

fetchData();
