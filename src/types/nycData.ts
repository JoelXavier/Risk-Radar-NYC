export interface DOBViolation {
    top_number: string;
    bin: string;
    boro: string;
    street: string;
    house_number: string;
    issue_date: string;
    violation_type_code: string;
    violation_number: string;
    violation_category: string;
    description: string;
}

export interface HPDViolation {
    violationid: string;
    buildingid: string;
    registrationid: string;
    boroid: string;
    boro: string;
    housenumber: string;
    lowhousenumber: string;
    highhousenumber: string;
    streetname: string;
    streetcode: string;
    postcode: string;
    apartment: string;
    story: string;
    block: string;
    lot: string;
    class: string;
    inspectiondate: string;
    approveddate: string;
    originalcorrectbydate: string;
    originalorderdate: string;
    ordernumber: string;
    novid: string;
    novdescription: string;
    novissueddate: string;
    currentstatusid: string;
    currentstatus: string;
    currentstatusdate: string;
    novtype: string;
    violationstatus: string;
    rentimpairing: string;
}
