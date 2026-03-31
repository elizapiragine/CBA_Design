# LinkedIn Metrics Dashboard Automation Guide

## Overview

This automation processes raw LinkedIn analytics exports into normalized, analysis-ready datasets for dashboard reporting. The system consolidates data from multiple LinkedIn export sources (page metrics, individual posts, follower location data, and competitor benchmarks) into clean, standardized sheets within Google Sheets.

**Purpose**: Enable streamlined LinkedIn performance tracking and competitive analysis without manual data manipulation.

---

## What the Automation Does

The automation suite consists of four primary functions that normalize LinkedIn data:

### 1. **normalizeLinkedInPageMetrics()** 
Consolidates page-level performance metrics from multiple sources into a single normalized sheet.

**Input Sources**:
- `LinkedIn_Export` — aggregated daily engagement metrics (impressions, clicks, reactions, comments, reposts)
- `Visitor Metrics` (optional) — page view and unique visitor data by section (Overview, Life, Jobs)
- `New Followers` (optional) — follower breakdown by acquisition type (organic, sponsored, auto-invited)

**Output Sheet**: `LinkedIn_Normalized_Metrics`

**Key Features**:
- Merges data by date across all three sources
- Calculates cumulative follower count using a baseline reference (row 758 = 35,957 followers)
- Formats dates as `YYYY-MM-DD` and engagement rates as percentages
- Handles missing data gracefully with zeros

---

### 2. **normalizeLinkedInAllPosts()**
Transforms individual post-level data into a standardized format with custom engagement metrics.

**Input Source**: `LinkedIn_AllPosts` sheet (raw LinkedIn post export)

**Output Sheet**: `LinkedIn_Normalized_Posts`

**Key Features**:
- Standardizes column naming (snake_case format)
- Calculates two custom engagement metrics:
  - `engagement_rate_custom` = (likes + comments + reposts) / impressions
  - `interaction_rate_custom` = (likes + comments + reposts + clicks) / impressions
- Auto-detects post language using Google Sheets' `DETECTLANGUAGE()` function (for titles ≥5 characters)
- Formats dates and percentage metrics appropriately

---

### 3. **normalizeFollowersLocation()**
Parses and enriches follower location data with geographic hierarchies.

**Input Source**: `Followers Location` sheet (raw location export)

**Output Sheet**: `Followers_Location_Clean`

**Key Features**:
- Extracts city and region from raw location strings
- Maps country names to ISO 2-letter codes
- Adds geographic hierarchy: Continent → Subcontinent
- Supports 20+ countries with pre-configured geolocation data
- Cleans region names (removes "Greater", "Metropolitan", etc.)

**Supported Regions**:
- **Europe**: France, Germany, Spain, Italy, Portugal, Netherlands, Belgium, UK
- **Americas**: USA, Canada, Brazil, Argentina, Mexico
- **Asia**: India, China, Japan, UAE
- **Africa**: South Africa, Egypt
- **Oceania**: Australia, New Zealand

---

### 4. **buildCbaBenchmarkMonthly()**
Aggregates monthly metrics and compares CBA Design performance against competitor averages.

**Input Source**: `Competitors LK` sheet (must have dates manually filled in column A)

**Output Sheet**: `CBA Benchmark`

**Key Features**:
- Groups data by month (`YYYY-MM` format)
- Calculates competitor average for New Followers and Reactions
- Computes percentage variance: `(CBA Value - Competitor Avg) / Competitor Avg`
- Formats percentage columns for clarity

---

## How to Run the Automation

### **Prerequisites**

1. **Access**: You need write access to the Google Sheet `elizapiragine/CBA_Design`
2. **Apps Script**: The functions are deployed in Google Apps Script (accessible via `Extensions > Apps Script` in Google Sheets)

### **Step-by-Step Execution**

#### **Step 1: Export Data from LinkedIn Analytics**

For each data source, navigate to LinkedIn's analytics pages and export the data:

| Data Source | LinkedIn Path | Sheet Name | Format |
|---|---|---|---|
| **Page Metrics** | Analytics > Performance | `LinkedIn_Export` | CSV/Excel |
| **Visitor Metrics** | Analytics > Visitors | `Visitor Metrics` | CSV/Excel |
| **New Followers** | Analytics > Followers | `New Followers` | CSV/Excel |
| **All Posts** | Analytics > Posts | `LinkedIn_AllPosts` | CSV/Excel |
| **Follower Location** | Analytics > Followers > Demographics | `Followers Location` | CSV/Excel |

#### **Step 2: Add Data to Google Sheet**

Paste each export into its corresponding sheet. The script expects:
- Row 1 (optional): Description/metadata
- Row 2: Column headers
- Row 3+: Data rows

#### **Step 3: Special Handling for Competitor Benchmark**

Before running `buildCbaBenchmarkMonthly()`:

1. Open the `Competitors LK` sheet
2. Manually fill in column A ("Date") with dates in `YYYY-MM-DD` format (e.g., `2026-03-31`)
3. Ensure all rows in the period have dates
4. **Then** run the function

#### **Step 4: Run the Functions**

In Google Apps Script Editor:

```javascript
// Run individual functions:
normalizeLinkedInPageMetrics();    // Takes ~5-10 seconds
normalizeLinkedInAllPosts();       // Takes ~5-10 seconds
normalizeFollowersLocation();      // Takes ~2-5 seconds
buildCbaBenchmarkMonthly();        // Takes ~2-5 seconds

// Or run all at once:
function runAllNormalizations() {
  normalizeLinkedInPageMetrics();
  normalizeLinkedInAllPosts();
  normalizeFollowersLocation();
  buildCbaBenchmarkMonthly();
  Logger.log('✓ All normalizations complete');
}