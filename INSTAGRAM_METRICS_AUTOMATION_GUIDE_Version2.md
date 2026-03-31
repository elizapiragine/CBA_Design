# Instagram Metrics Dashboard Automation Guide

## Overview

This automation suite processes raw Instagram analytics data from Meta's Graph API into normalized, analysis-ready datasets for dashboard reporting. The system consolidates data from multiple sources (page insights, demographics, follower tracking, and website clicks) into clean, standardized Google Sheets for performance tracking and audience analysis.

**Purpose**: Enable streamlined Instagram performance tracking, demographic analysis, and competitor benchmarking without manual data manipulation.

---

## Critical Setup: Access Token Management

### ⚠️ Important: Instagram Access Token Expiration

Instagram access tokens expire quickly (typically within hours). You **must** generate a fresh token before running any automation script.

### Step 1: Generate a New Access Token

1. Navigate to **[Meta Graph API Explorer](https://developers.facebook.com/tools/explorer/)**
2. Log in with your Meta/Facebook account
3. In the top dropdown, select your Instagram Business App
4. In the "Permissions" section, ensure these scopes are selected:
   - `instagram_basic`
   - `instagram_insights`
   - `pages_read_engagement`
5. Click **"Generate Access Token"**
6. Copy the token (begins with `EAAB...`)

### Step 2: Update Google Apps Script Properties

1. Open your Google Sheets document
2. Click **Extensions > Apps Script**
3. In the Apps Script editor, click the gear icon ⚙️ → **Project Settings**
4. Scroll to **Script Properties** section
5. Add/update these properties:
   - **Key**: `IG_ACCESS_TOKEN` | **Value**: *paste your token here*
   - **Key**: `IG_ORG` | **Value**: *your Instagram Account ID* (numeric)
   - **Key**: `IG_USER_ID` | **Value**: *your Instagram User ID* (numeric)

   *(If you don't have these IDs, use the Graph API Explorer to query `/me` on your app to find them)*

6. Click **Save**

### ⏰ Token Refresh Schedule

- **Before each automation run**: Generate a fresh token (takes 2 minutes)
- **Set a calendar reminder**: Tokens expire within hours; don't rely on old tokens
- **Error indicator**: If you see "error validating access token" or "code 190" in logs, refresh immediately

---

## What the Automation Does

The automation suite consists of five primary scripts that fetch, normalize, and summarize Instagram data:

### 1. **normalize_instagram_insights.js** ← Main Insights Capture
Fetches and normalizes account-level and per-post Instagram performance metrics across configurable date ranges.

**Input Source**: Meta Graph API (`/{ig-user-id}/insights` endpoint)

**Output Sheets**:
- `IG_Insights_History` — raw daily aggregated metrics (impressions, reach, engagement, etc.)
- `IG_Insights_Account` — account-level daily summaries (one row per day with all metrics wide)
- `IG_Insights_Breakdown_Snap` — daily breakdowns (reach × media_product_type, total_interactions × contact_button_type)
- `IG_Insights_Media` — per-post metrics with product type breakdowns

**Available Functions**:
```javascript
runInsightsHistory_0_30()    // Last 30 days (includes today)
runInsightsHistory_31_55()   // Days 31-55 ago
runInsightsHistory_56_81()   // Days 56-81 ago
```

**Key Features**:
- Splits history into 3 ranges (0-30, 31-55, 56-81 days) to avoid API timeout
- Captures 9 core metrics: reach, views, profile_views, accounts_engaged, total_interactions, likes, comments, shares, saves
- Auto-generates breakdown snapshots (media_product_type, follow_type, contact_button_type)
- Captures per-post insights automatically (media_id, media_type, metrics, breakdowns)
- Handles API errors gracefully with detailed debug logging
- Includes cumulative follower tracking (via separate follower script)

**Metrics Captured**:
- **Reach metrics**: reach, impressions, profile_views
- **Engagement metrics**: likes, comments, shares, saves, total_interactions
- **Audience metrics**: accounts_engaged, views

**Core Logic**:
```javascript
const HISTORY_METRICS_SPLIT = [
  'reach','views','profile_views','accounts_engaged',
  'total_interactions','likes','comments','shares','saves'
];

const HISTORY_BREAKDOWN_CONFIG = {
  reach: ['media_product_type', 'follow_type'],
  total_interactions: ['contact_button_type']
};
```

---

### 2. **normalize_instagram_demo.js** ← Demographics Data
Fetches audience demographic data with multiple breakdown dimensions.

**Input Source**: Meta Graph API (`/{ig-user-id}/insights?metric=follower_demographics,engaged_audience_demographics`)

**Output Sheet**: `IG_Insights_Demographics`

**Available Function**:
```javascript
runInsightsDemographicsFixed()
```

**Key Features**:
- Requests both follower and engaged audience demographic breakdowns
- Supports 4 breakdown dimensions: age, gender, country, city
- Automatic token validation (detects expired/invalid tokens early)
- Distinguishes between app permission errors (continue) vs token errors (stop)
- Formats data regardless of API response shape (handles multiple JSON structures)
- Timestamps all records with retrieval time for versioning

**Breakdowns**:
- **Age**: 13-17, 18-24, 25-34, 35-44, 45-54, 55-64, 65+
- **Gender**: F (female), M (male), U (unknown)
- **Country**: Full country names (supports 190+ countries)
- **City**: Major cities within countries

**Core Configuration**:
```javascript
const DEMO_TIMEFRAME_DEFAULT = 'this_month';
const DEMO_BREAKDOWNS = ['age', 'gender', 'country', 'city'];
const DEMO_METRICS = ['follower_demographics', 'engaged_audience_demographics'];
```

---

### 3. **summarize_demographics.js** ← Demographics Aggregation
Generates clean summary sheets for each demographic combination with smart sorting and filtering.

**Input Source**: `IG_Insights_Demographics` (raw demographic data)

**Output Sheets** (auto-generated):
- `IG_Demo_follower_age` — Followers by age group
- `IG_Demo_follower_gender` — Followers by gender
- `IG_Demo_follower_country` — Followers by country (top 200)
- `IG_Demo_follower_city` — Followers by city (top 200)
- `IG_Demo_engaged_age` — Engaged audience by age group
- `IG_Demo_engaged_gender` — Engaged audience by gender
- `IG_Demo_engaged_country` — Engaged audience by country (top 200)
- `IG_Demo_engaged_city` — Engaged audience by city (top 200)

**Available Functions**:
```javascript
summarizeAllDemographics()                          // Generates all 8 sheets
summarizeDemographics(metric, breakdown, destName) // Generates one specific sheet
```

**Example Usage**:
```javascript
// Generate all demographics summaries
summarizeAllDemographics({ topN: 150 }); // top 150 countries/cities instead of default 200

// Generate just follower age breakdown
summarizeDemographics('follower_demographics', 'age', 'IG_Demo_follower_age');
```

**Key Features**:
- **Smart sorting**:
  - Age: Logical order (13-17 → 18-24 → ... → 65+)
  - Gender: Preferred order (F, M, U) then others alphabetically
  - Country/City: Sorted by value descending, top-N filtering
- Keeps most recent snapshot per dimension (uses retrieved_at timestamp)
- One-row-per-dimension format: [Dimension | Total_value | timeframe | retrieved_at]
- Auto-creates sheets if missing, overwrites existing data

**Age Order Logic**:
```javascript
const ageOrder = ['13-17','18-24','25-34','35-44','45-54','55-64','65+'];
```

---

### 4. **fetch_instagram_follow.js** ← Follower Tracking
Tracks daily follow/unfollow activity broken down by follower type.

**Input Source**: Meta Graph API (`/{ig-user-id}/insights?metric=follows_and_unfollows&breakdown=follow_type`)

**Output Sheets**:
- `IG_Followers_RAW` — Raw daily follower/non-follower changes
- `IG_Followers` — Historical follower counts (backdated from known baseline)
- `IG_Followers_Future` — Forward-projected follower counts

**Available Functions**:
```javascript
fetchInstagramFollowBreakdown()  // Fetch last 30 days of follow data
calculateFollowerPast()          // Calculate historical follower totals
calculateFollowerFuture()        // Project future follower totals
```

**Key Features**:
- Fetches daily follow/unfollow breakdown (FOLLOWER vs NON_FOLLOWER categories)
- Uses baseline anchor date (2026-03-23 = 5,294 followers) to backtrack historical totals
- Calculates net change per day (followers - non-followers)
- Projects forward and backward from anchor point
- Stores raw API response separately for audit trail

**Data Flow**:
1. `fetchInstagramFollowBreakdown()` → `IG_Followers_RAW` (raw daily changes)
2. `calculateFollowerPast()` → `IG_Followers` (historical cumulative totals)
3. `calculateFollowerFuture()` → `IG_Followers_Future` (forward projections)

**Output Format**:
- Date | Followers | Non-Followers | Net Change | Total Followers

**Baseline Configuration**:
```javascript
const fixedFollowersOn20260323 = 5294;
const targetDate = new Date("2026-03-23");
```

**Backtrack Formula**:
```
totalFollowers = fixedFollowersOn20260323 - (cumulative net change from this date until baseline date)
```

---

### 5. **fetch_website_clicks.js** ← Website Click Tracking
Captures website click metrics from Instagram profile link (CTAs).

**Input Source**: Meta Graph API (`/{ig-user-id}/insights?metric=website_clicks`)

**Output Sheet**: `IG_Insights_Website_Clicks`

**Available Function**:
```javascript
fetchWebsiteClicksHistory()  // Fetch last 180 days of website click data
```

**Key Features**:
- Fetches daily `website_clicks` metric for the last 180 days
- Handles both single-value responses and array responses
- Each day is one API call; 180 days = 180 requests (spaced 700ms apart)
- Formats: [end_time | metric | period | metric_type | value | retrieved_at]
- Gracefully handles missing data (logs and continues)

**Configuration**:
```javascript
const SHEET_NAME = 'IG_Insights_Website_Clicks';
const METRIC = 'website_clicks';
const DAYS_BACK = 180;
const PAUSE_MS = 700;
```

---

## How to Run the Automation

### **Prerequisites**

1. **Fresh Access Token**: Follow Step 1-2 above to generate and store a new token
2. **Sheet Tabs Exist**: Ensure your Google Sheet has tabs for each output (or the scripts auto-create them)
3. **Apps Script Access**: You need write access to the Google Sheet's Apps Script editor

### **Execution Order & Timing**

#### **Phase 1: Data Capture (10-15 minutes total)**

Run in this order:

```javascript
// 1. Follower tracking (~3 seconds)
fetchInstagramFollowBreakdown();
calculateFollowerPast();
calculateFollowerFuture();

// 2. Website clicks (~2-3 minutes for 180 days)
fetchWebsiteClicksHistory();

// 3. Demographics (~1-2 minutes for all breakdowns)
runInsightsDemographicsFixed();

// 4. Main insights history (longest - ~10 minutes for 81 days)
// Run in 3 phases to avoid API timeout:
runInsightsHistory_0_30();      // Pause 2 min, then:
runInsightsHistory_31_55();     // Pause 2 min, then:
runInsightsHistory_56_81();
```

#### **Phase 2: Data Summarization (30 seconds)**

```javascript
// 5. Generate demographic summary sheets
summarizeAllDemographics();
```

### **Quick-Run Function (All in One)**

If you want to run everything at once, create this wrapper:

```javascript
function runAllInstagramAutomation() {
  Logger.log('Starting Instagram automation suite...');
  
  try {
    Logger.log('Phase 1: Fetching follower data...');
    fetchInstagramFollowBreakdown();
    calculateFollowerPast();
    calculateFollowerFuture();
    
    Logger.log('Phase 2: Fetching website clicks (180 days)...');
    fetchWebsiteClicksHistory();
    
    Logger.log('Phase 3: Fetching demographics...');
    runInsightsDemographicsFixed();
    
    Logger.log('Phase 4a: Fetching insights history 0-30 days...');
    runInsightsHistory_0_30();
    Utilities.sleep(120000); // 2 min pause
    
    Logger.log('Phase 4b: Fetching insights history 31-55 days...');
    runInsightsHistory_31_55();
    Utilities.sleep(120000); // 2 min pause
    
    Logger.log('Phase 4c: Fetching insights history 56-81 days...');
    runInsightsHistory_56_81();
    
    Logger.log('Phase 5: Summarizing demographics...');
    summarizeAllDemographics();
    
    Logger.log('✓ All Instagram automation complete!');
  } catch (e) {
    Logger.log('ERROR in automation suite: ' + String(e.message));
    throw e;
  }
}
```

### **Step-by-Step Execution (Manual)**

1. **Open Apps Script**: Google Sheet → Extensions > Apps Script
2. **Select function**: In the top dropdown, choose the function to run
3. **Click Run** (play button)
4. **Check Execution Log**: Click **Execution log** to see progress and errors
5. **Wait for completion**: Each function logs its final status
6. **Refresh Google Sheet**: `Ctrl+Shift+F5` to see new data

### **Automated Scheduling (Optional)**

To run on a schedule (e.g., daily at 8 AM):

1. In Apps Script, click **Triggers** (clock icon)
2. Click **Create new trigger**
3. Choose:
   - Function: `runAllInstagramAutomation` (or individual function)
   - Deployment: Head
   - Event source: Time-driven
   - Type: Day timer
   - Time of day: 8:00 AM - 9:00 AM
4. Click **Save**

---

## Data Export: Posts Breakdown (Manual Step)

### ⚠️ Current Limitation

**Posts breakdown data (post-level metrics) is NOT yet automated.** This must be exported manually from Meta Business Suite.

### Manual Export Instructions

1. Go to **Meta Business Suite** → **Instagram** → **Insights**
2. Navigate to **Posts** tab
3. Select date range (usually last 30 days)
4. Click **Export** → Download as CSV
5. Open your Google Sheet
6. Create or open tab named `IG_Posts_History_25` (or your chosen name)
7. Paste the CSV data
8. The `normalize_instagram_insights.js` script references post data for per-media insights

### Planned Automation

Post-level data automation is in development. Once available, it will:
- Automatically fetch post insights via Graph API
- Generate breakdown by post type (carousel, video, image)
- Track engagement per post

---

## Limitations & Considerations

### **Known Limitations**

#### 1. **Access Token Expiration (CRITICAL)**
- **Issue**: Instagram tokens expire within 24 hours (sometimes faster)
- **Impact**: Any automation run with an expired token will fail with "code 190" error
- **Workaround**: Generate a fresh token before every automation run (takes 2 minutes)
- **Future**: Consider implementing automated token refresh via Meta API

#### 2. **History Range (81 days max)**
- **Issue**: Fetching all 81 days in one request causes API timeout (~30 min execution time limit)
- **Impact**: Automation splits into 3 ranges (0-30, 31-55, 56-81) requiring 3 separate runs
- **Workaround**: Run phases sequentially with 2-minute pauses between them
- **Performance**: 
  - 0-30 days: ~3-5 minutes
  - 31-55 days: ~3-5 minutes
  - 56-81 days: ~3-5 minutes
  - Total: ~15 minutes for full history

#### 3. **Posts Breakdown (Manual Export)**
- **Issue**: Meta Graph API doesn't expose detailed post-level breakdowns we need
- **Impact**: Post engagement data must be manually exported from Meta Business Suite
- **Workaround**: Export monthly and paste into `IG_Posts_History_25` tab
- **Frequency**: Monthly or quarterly export sufficient for trend analysis
- **Timeline**: Post-level automation planned for Q2 2026

#### 4. **Demographic Data Limitations**
- **Age groups**: Only predefined buckets (13-17, 18-24, etc.); cannot segment by individual age
- **Country/City**: Limited to followers' disclosed location; many users set private or leave blank
- **Gender**: Facebook's classification system (F/M/U); may not match user identity
- **Update frequency**: Demographic data updates daily, sometimes with 12-24 hour lag

#### 5. **API Rate Limiting**
- **Issue**: Meta Graph API has rate limits (~200 requests per hour per app)
- **Impact**: Running multiple automations simultaneously may hit rate limits
- **Workaround**: 
  - Space automation runs at least 2 hours apart
  - Run during off-peak hours (early morning/late night)
  - Monitor execution log for rate-limit errors (HTTP 429)
- **Current padding**: Scripts include 700ms pauses between requests to mitigate

#### 6. **Breakdowns Availability**
- **Issue**: Not all metrics support all breakdowns
  - `reach` supports: media_product_type, follow_type
  - `total_interactions` supports: contact_button_type
  - `views` not available for all content types
- **Impact**: Some breakdown combinations may return empty or error
- **Workaround**: Scripts catch these errors and log as "NO_APP_PERMISSION" or "200-empty"
- **Expected**: Scripts continue operation; no data loss

#### 7. **Time Zone Handling**
- **Issue**: Instagram data is in UTC; local time zone may differ
- **Impact**: Daily aggregations may appear offset by ±12 hours depending on your location
- **Workaround**: All data stored in UTC (ISO 8601 format: YYYY-MM-DDTHH:MM:SSZ)
- **Fix**: When displaying in dashboard, convert to your local time zone

### **Data Assumptions & Requirements**

- **Date Format**: All dates are ISO 8601 (YYYY-MM-DD or full timestamp)
- **Numeric Fields**: All metrics are numbers; empty/missing = 0 or empty string depending on field
- **No Duplicates**: Scripts assume one entry per day per metric (duplicates may skew data)
- **Permissions**: Your app must have these permissions approved:
  - `instagram_basic` — read profile info
  - `instagram_insights` — read analytics
  - `pages_read_engagement` — read engagement metrics

---

## Code Structure & Dependencies

### **Main Scripts**

```
normalize_instagram_insights.js       (450+ lines)
  ├─ runInsightsHistory_0_30()
  ├─ runInsightsHistory_31_55()
  ├─ runInsightsHistory_56_81()
  ├─ runInsightsHistoryRange(startDayAgo, endDayAgo, opts)
  ├─ writeAccountSummaryFromFlattened()
  ├─ fetchAndWriteBreakdownSnapshotForDay()
  ├─ fetchAndWriteMediaInsightsForDay()
  ├─ getUserMediaListForWindow()
  ├─ flattenDailyInsightsHistoryDayLocal()
  ├─ parseBreakdownResultsFromJson()
  └─ References: IG_Insights_History, IG_Insights_Account, IG_Insights_Breakdown_Snap, IG_Insights_Media

normalize_instagram_demo.js           (200+ lines)
  ├─ runInsightsDemographicsFixed()
  ├─ flattenDemographicsAnyShape_()
  ├─ checkAccessTokenValid_() [optional]
  └─ References: IG_Insights_Demographics

summarize_demographics.js             (200+ lines)
  ├─ summarizeAllDemographics(opts)
  ├─ summarizeDemographics(metric, breakdown, destName, opts)
  ├─ makeSheetName_(metric, breakdown)
  └─ References: IG_Insights_Demographics → IG_Demo_*

fetch_instagram_follow.js             (150+ lines)
  ├─ fetchInstagramFollowBreakdown()
  ├─ calculateFollowerPast()
  ├─ calculateFollowerFuture()
  └─ References: IG_Followers_RAW, IG_Followers, IG_Followers_Future

fetch_website_clicks.js               (100+ lines)
  ├─ fetchWebsiteClicksHistory()
  └─ References: IG_Insights_Website_Clicks
```

### **Helper Functions (Embedded in Scripts)**

| Function | Purpose | Location |
|---|---|---|
| `flattenDailyInsightsHistoryDayLocal()` | Parse daily API responses into flat rows | normalize_instagram_insights.js |
| `parseBreakdownResultsFromJson()` | Extract dimension/value pairs from breakdown responses | normalize_instagram_insights.js |
| `flattenDemographicsAnyShape_()` | Handle multiple JSON response formats for demographics | normalize_instagram_demo.js |
| `findRowIndexInSheet()` | Search sheet for existing row to avoid duplicates | normalize_instagram_insights.js |
| `makeSheetName_()` | Generate safe sheet names from metric+breakdown | summarize_demographics.js |

### **Required External Dependencies**

- **Google Apps Script APIs**:
  - `SpreadsheetApp` — sheet access & manipulation
  - `UrlFetchApp` — HTTP requests to Graph API
  - `PropertiesService` — read IG_ACCESS_TOKEN, IG_ORG, IG_USER_ID
  - `Logger` — logging (visible in Execution log)
  - `Utilities.sleep()` — rate-limiting pauses
  - `Date` objects — timestamp handling

- **Meta Graph API**:
  - `https://graph.facebook.com/v25.0/{ig-user-id}/insights` — all metrics
  - Requires: Valid IG_ACCESS_TOKEN, IG_ORG, IG_USER_ID in Script Properties

---

## Error Messages & Troubleshooting

| Error | Cause | Solution |
|---|---|---|
| `"error validating access token"` or `code 190` | Token expired or invalid | Generate fresh token via [Graph API Explorer](https://developers.facebook.com/tools/explorer/) and update Script Properties |
| `"IG_ORG não encontrado em Script Properties"` | Missing Instagram Account ID | Get your Account ID from `/me` endpoint in Graph API Explorer; add to Script Properties |
| `"IG_ACCESS_TOKEN não encontrado"` | Missing access token in Script Properties | Generate token and add to Script Properties (key: `IG_ACCESS_TOKEN`) |
| `"application does not have permission"` (code 10) | App lacks required permissions | Review app permissions in Meta App Dashboard; request missing scopes (instagram_insights, pages_read_engagement) |
| `HTTP 429 Too Many Requests` | Rate limit exceeded | Wait 1 hour; space automation runs at least 2 hours apart |
| `"Aba fonte não encontrada"` | Source sheet doesn't exist (e.g., `IG_Insights_Demographics` missing) | Run `runInsightsDemographicsFixed()` first to create source data |
| `"Execution time limit exceeded (30 min)"` | Script took >30 minutes to run | This usually means fetching all 81 days at once; use split functions instead (0-30, 31-55, 56-81) |
| `Empty data returned (200-empty)` | API returned OK but no data for that breakdown | This is normal if account has no engagement for that day; script continues safely |

---

## Data Dictionary

### IG_Insights_History (Raw Daily Metrics)

| Column | Type | Description | Example |
|---|---|---|---|
| end_time | Date | Date of the metric (UTC) | 2026-03-31 |
| metric | Text | Metric name | reach |
| period | Text | Always "day" for daily metrics | day |
| metric_type | Text | Always "total_value" | total_value |
| value | Number | Metric value | 1250 |
| retrieved_at | Timestamp | When data was fetched | 2026-03-31T14:30:00Z |

### IG_Insights_Account (Daily Summaries)

| Column | Type | Description |
|---|---|---|
| end_time | Date | Day of metrics |
| period | Text | "day" |
| metric_type | Text | "total_value" |
| Reach | Number | People reached |
| views | Number | Total views |
| profile_views | Number | Profile visits |
| accounts_engaged | Number | Unique accounts interacting |
| total_interactions | Number | Sum of all interactions |
| likes | Number | Total likes |
| comments | Number | Total comments |
| shares | Number | Total shares |
| saves | Number | Total saves |
| retrieved_at | Timestamp | Fetch timestamp |

### IG_Insights_Demographics (Demographic Breakdowns)

| Column | Type | Description | Example |
|---|---|---|---|
| metric | Text | follower_demographics or engaged_audience_demographics | follower_demographics |
| timeframe | Text | Always "this_month" (configurable) | this_month |
| breakdown | Text | age, gender, country, or city | country |
| dimension | Text | Specific segment value | Brazil |
| value | Number | Count or percentage | 1542 |
| retrieved_at | Timestamp | Fetch timestamp | 2026-03-31T14:30:00Z |

### IG_Demo_* (Summary Sheets - e.g., IG_Demo_follower_country)

| Column | Type | Description |
|---|---|---|
| Dimension | Text | Country, city, age group, or gender |
| Total_value | Number | Count of followers/engaged users |
| timeframe | Text | Data time period |
| retrieved_at | Timestamp | Most recent snapshot for this dimension |

### IG_Followers (Historical Follower Totals)

| Column | Type | Description |
|---|---|---|
| Date | Date | Day (YYYY-MM-DD) |
| Followers | Number | New followers that day |
| Non-Followers | Number | New non-followers (unfollows) |
| Net Change | Number | Followers - Non-Followers |
| Total Followers | Number | Cumulative total followers on that date |

### IG_Insights_Website_Clicks (Daily Click Data)

| Column | Type | Description |
|---|---|---|
| end_time | Date | Day of clicks |
| metric | Text | "website_clicks" |
| period | Text | "day" |
| metric_type | Text | "total_value" |
| value | Number | Number of clicks to external website |
| retrieved_at | Timestamp | Fetch timestamp |

---

## Dashboard Integration

**All output sheets are ready for dashboard visualization**:

- `IG_Insights_Account` — Time-series charts (reach, engagement trends)
- `IG_Insights_Breakdown_Snap` — Breakdowns by product type, follow type, button type
- `IG_Insights_Website_Clicks` — Click conversion funnel
- `IG_Demo_follower_*` — Demographic audience breakdowns (pie charts, geographic maps)
- `IG_Demo_engaged_*` — Engaged audience breakdowns (comparison with followers)
- `IG_Followers` — Follower growth trends with net change analysis

All outputs use standardized formatting (dates as YYYY-MM-DD, timestamps as ISO 8601) for seamless dashboard connection.

---

## Performance & Costs

### **Execution Time**

| Operation | Time | Notes |
|---|---|---|
| fetchInstagramFollowBreakdown() | 30 sec | 30 API calls (1 per day × 30 days) |
| calculateFollowerPast() | 5 sec | Local sheet calculation |
| calculateFollowerFuture() | 5 sec | Local sheet calculation |
| fetchWebsiteClicksHistory() | 2-3 min | 180 API calls (1 per day × 180 days) with 700ms pauses |
| runInsightsDemographicsFixed() | 1-2 min | 8 API calls (2 metrics × 4 breakdowns) |
| runInsightsHistory_0_30() | 3-5 min | 30+ API calls (multiple metrics per day + breakdowns + media) |
| runInsightsHistory_31_55() | 3-5 min | Same as above |
| runInsightsHistory_56_81() | 3-5 min | Same as above |
| summarizeAllDemographics() | 30 sec | Local sheet processing (no API calls) |
| **Total Full Run** | **~15 min** | If run sequentially |

### **API Quota Usage**

- **Meta Graph API**: ~400-500 requests per full run
  - Limit: ~200 requests/hour for standard apps
  - **Recommendation**: Run automation during off-peak hours (before 6 AM or after 8 PM)
  - **Frequency**: Safe to run daily or every 6 hours

### **Google Sheets Quota**

- **Reads**: ~50-100 per run (loading data for summaries)
- **Writes**: ~1000-2000 cells per run
- **Limit**: Google Sheets has no hard limit for writes within a project; very generous

---

## Maintenance & Updates

### **When to Update Code**

- **Add new metrics**: Edit `HISTORY_METRICS_SPLIT` array in normalize_instagram_insights.js
- **Change breakdown config**: Edit `HISTORY_BREAKDOWN_CONFIG` object
- **Adjust date ranges**: Modify function parameters (e.g., `runInsightsHistory_0_30()`)
- **Add new sheet summarization**: Add to `DEMO_METRICS_ALL` or `DEMO_BREAKDOWNS_ALL` in summarize_demographics.js
- **Change follower baseline**: Update `fixedFollowersOn20260323` and `targetDate` in fetch_instagram_follow.js

### **Version Control**

Current scripts are located in: `elizapiragine/CBA_Design` repository

### **Monitoring & Logging**

All scripts include comprehensive logging:
- Open **Apps Script** → **Execution log** to see real-time progress
- Errors include call stack and context for debugging
- Each fetch includes timestamp for audit trail

---

## Contact & Support

For issues or updates to this automation, refer to the repository:
- **Repository**: elizapiragine/CBA_Design
- **Language**: Google Apps Script (JavaScript)
- **API Version**: Meta Graph API v25.0
- **Last Updated**: 2026-03-31

---

## Quick Reference: Running Order

```
1. Generate fresh access token (via Graph API Explorer)
2. Update Script Properties: IG_ACCESS_TOKEN
3. Run: fetchInstagramFollowBreakdown() + calculateFollowerPast() + calculateFollowerFuture()
4. Run: fetchWebsiteClicksHistory()
5. Run: runInsightsDemographicsFixed()
6. Run: runInsightsHistory_0_30()
   [Wait 2 min]
7. Run: runInsightsHistory_31_55()
   [Wait 2 min]
8. Run: runInsightsHistory_56_81()
9. Run: summarizeAllDemographics()
10. Check sheets: All data populated ✓
11. Refresh dashboard
```