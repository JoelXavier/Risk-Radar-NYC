# Risk Radar NYC

**Risk Radar** is an interactive web application designed to visualize and quantify building safety risks across New York City. By aggregating data from multiple NYC Open Data sources, it creates a transparent "Safety Risk Score" for buildings, empowering residents to make informed housing decisions.

## Key Features

- **Interactive Risk Map** 🗺️
  - A color-coded map (Green to Red) visualizing building safety scores across neighborhoods.
- **Comprehensive Risk Scoring** 📊
  - Calculates a 0-100 risk score based on:
    - **DOB Violations** (Structural/Safety issues)
    - **HPD Violations** (Housing maintenance/conditions)
    - **311 Complaints** (Heat, hot water, noise, etc.)
    - **Building Age & Permit History**
- **Detailed Building Insights** 🏢
  - Click on any building to see specific violations, complaint history, and owner information (piercing the LLC veil).
- **Search & Filter** 🔍
  - Easily find specific addresses or filter the map to see only "High Risk" properties.
- **Transparency** 🔓
  - Direct access to public data that is often hard to find or understand in isolation.

## Benefits

| Audience             | Benefit                                                                         |
| :------------------- | :------------------------------------------------------------------------------ |
| **Renters & Buyers** | Check a building's safety and management history _before_ signing a lease.      |
| **Tenants**          | Get specific evidence of neglect to use in advocacy or housing court cases.     |
| **Community Groups** | Identify "slumlord" patterns where specific owners neglect multiple properties. |
| **City Officials**   | Identify hotspots of neglect that require enforcement action.                   |

---

## Getting Started

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

### Prerequisites

- Node.js (version 18 or later recommended)
- npm, yarn, pnpm, or bun

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/JoelXavier/Risk-Radar-NYC.git
    cd Risk-Radar-NYC
    ```

2.  Install dependencies:

    ```bash
    npm install
    # or
    yarn install
    ```

3.  Run the development server:

    ```bash
    npm run dev
    # or
    yarn dev
    ```

4.  Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
