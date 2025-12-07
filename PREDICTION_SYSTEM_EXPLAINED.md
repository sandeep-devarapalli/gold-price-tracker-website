# How Future Predictions Work - Complete Explanation

## Overview

The gold price prediction system generates predictions for the next 7 days, stores them in the database, and automatically compares them with actual prices once they become available. Here's exactly how it works:

---

## 1. Prediction Generation Process

### When Predictions Are Created

Predictions are **automatically generated** after the news scraper runs (scheduled daily at 12:30 PM IST). The system:

1. **Collects all necessary data:**
   - Latest gold prices (from `gold_prices` table)
   - Recent market data (US indices, India indices, USD/INR)
   - Bitcoin prices
   - Latest news articles (scraped that day)
   - Historical price trends

2. **Sends data to OpenAI** to generate predictions for the next 7 days

3. **Saves predictions** to the `gold_price_predictions` table

### Database Schema for Predictions

```sql
gold_price_predictions (
    id SERIAL PRIMARY KEY,
    predicted_date DATE NOT NULL,        -- The date being predicted (e.g., Dec 10, 2024)
    predicted_price_1g DECIMAL(10, 2),   -- Predicted price per gram
    predicted_price_10g DECIMAL(10, 2),  -- Predicted price for 10 grams
    confidence DECIMAL(5, 2),            -- Confidence score (0-100)
    reasoning TEXT,                      -- AI's explanation
    factors JSONB,                       -- Key factors used
    created_at TIMESTAMP,                -- When prediction was made
    UNIQUE(predicted_date)               -- Only one prediction per date
)
```

**Important:** The system preserves existing predictions. If a prediction already exists for a date, it won't be overwritten by new predictions.

---

## 2. Actual Price Storage (Separate Table)

Actual gold prices are stored in a **completely separate table**:

```sql
gold_prices (
    id SERIAL PRIMARY KEY,
    price_10g DECIMAL(10, 2),
    price_1g DECIMAL(10, 2),
    country VARCHAR(100),
    timestamp TIMESTAMP,                 -- When price was scraped
    source VARCHAR(50),
    UNIQUE(country, DATE(timestamp))     -- One price per day per country
)
```

The gold price scraper runs **daily** (scheduled at 9:00 AM IST) and stores the actual price for that day.

---

## 3. What Happens When a Predicted Day Arrives?

### Scenario: You predicted prices for Dec 10-17, and now it's Dec 11

Here's the step-by-step process:

#### Step 1: Actual Price Gets Scraped (Dec 11, 9:00 AM IST)

- The gold price scraper runs
- It scrapes the current gold price
- Stores it in `gold_prices` table with `timestamp = Dec 11, 2024`

#### Step 2: Predictions Remain Unchanged

- **The prediction for Dec 11 is NOT deleted or modified**
- It stays in `gold_price_predictions` table exactly as it was predicted
- The predicted price, confidence, and reasoning remain intact

#### Step 3: System Joins Data for Display

When you view the "Prediction vs Actual Performance" chart, the system:

1. **Fetches predictions** from `gold_price_predictions` (past 7 days + future 7 days)
2. **Fetches actual prices** from `gold_prices` for dates up to today
3. **Joins them by date** to create combined data points

Here's the SQL logic (from `getAllPredictionsWithActuals`):

```typescript
// Get predictions for date range
SELECT predicted_date, predicted_price_1g, ...
FROM gold_price_predictions
WHERE predicted_date >= (today - 7 days) 
  AND predicted_date <= (today + 7 days)

// Get actual prices for past dates (up to today)
SELECT DATE(timestamp) as price_date, price_1g
FROM gold_prices
WHERE DATE(timestamp) >= (today - 7 days)
  AND DATE(timestamp) <= today

// Join them by date to create combined result
{
  date: "2024-12-11",
  predicted_price_1g: 6250.00,    // From predictions table
  actual_price_1g: 6275.50,       // From gold_prices table
  has_actual: true                // Indicates actual is available
}
```

#### Step 4: Frontend Displays Both

The chart shows:
- **Orange dashed line**: Past predictions (what was predicted)
- **Blue solid line**: Actual prices (what really happened)
- **Visual comparison**: You can see how close/far the predictions were

---

## 4. Accuracy Tracking (Automatic Validation)

The system has an **optional accuracy tracking system** that runs separately:

### Purpose

Tracks prediction accuracy metrics over time for model improvement.

### When It Runs

- Can be triggered manually via API: `POST /api/accuracy/validate`
- Or via a script: `npm run validate-predictions`

### What It Does

1. **Finds predictions** where `predicted_date <= today` (past predictions)
2. **Looks up actual prices** for those dates from `gold_prices` table
3. **Calculates errors:**
   - Error amount: `actual - predicted`
   - Error percentage: `(error / actual) * 100`
   - Direction accuracy: Did it predict up/down correctly?
4. **Stores results** in `prediction_accuracy_tracking` table

### Accuracy Tracking Schema

```sql
prediction_accuracy_tracking (
    id SERIAL PRIMARY KEY,
    prediction_date DATE,
    predicted_price_1g DECIMAL(10, 2),
    actual_price_1g DECIMAL(10, 2),
    error_amount DECIMAL(10, 2),          -- actual - predicted
    error_percentage DECIMAL(5, 2),       -- (error / actual) * 100
    absolute_error DECIMAL(10, 2),        -- |error|
    direction_correct BOOLEAN,            -- Did direction match?
    confidence_score DECIMAL(5, 2),
    factors_used JSONB,
    validated_at TIMESTAMP                -- When validation happened
)
```

**Note:** Accuracy tracking is separate from the main prediction system. The chart works fine without it.

---

## 5. Complete Example Timeline

Let's trace what happens day by day:

### **Day 1 (Dec 7, 2024) - Initial Prediction**

**Morning (9:00 AM):**
- Scraper runs, gets actual price: ₹6,250/g
- Stores in `gold_prices`: `{date: Dec 7, price_1g: 6250}`

**Afternoon (12:30 PM):**
- News scraper runs
- Prediction service generates predictions for **Dec 8-14** (next 7 days)
- Stores in `gold_price_predictions`:
  ```
  {date: Dec 8, predicted_price_1g: 6260}
  {date: Dec 9, predicted_price_1g: 6270}
  {date: Dec 10, predicted_price_1g: 6280}
  ... (Dec 11-14)
  ```

**Frontend Display:**
- Chart shows: Past prices (up to Dec 7) + Future predictions (Dec 8-14)
- Dec 8-14 show only predicted prices (no actual yet)

---

### **Day 2 (Dec 8, 2024) - First Predicted Day Arrives**

**Morning (9:00 AM):**
- Scraper runs, gets actual price: ₹6,255/g
- Stores in `gold_prices`: `{date: Dec 8, price_1g: 6255}`

**System Behavior:**
- Prediction for Dec 8 **stays in database unchanged** (still shows ₹6,260)
- Actual price is stored separately

**Frontend Display:**
- Chart now shows:
  - **Dec 8**: 
    - Orange dot (predicted): ₹6,260
    - Blue dot (actual): ₹6,255
    - Error: ₹5 (predicted too high)

**Afternoon (12:30 PM):**
- News scraper runs and checks existing predictions
- System calculates: Only Dec 14 is missing (Dec 8-13 already exist)
- **Only Dec 14 prediction is generated and added**
- **Dec 8-13 predictions are preserved** (not regenerated)
- Result: Future predictions now span Dec 8-14 (7 days maintained)

---

### **Day 3 (Dec 9, 2024) - Another Day Passes**

**Morning:**
- Actual price scraped: ₹6,270/g
- Stored in `gold_prices`

**Frontend:**
- Dec 9 now shows both predicted (₹6,270) and actual (₹6,270) - perfect match!
- Dec 8 still shows the error (predicted ₹6,260, actual ₹6,255)

**Afternoon:**
- News scraper runs and checks existing predictions
- System calculates: Only Dec 15 is missing (Dec 9-14 already exist)
- **Only Dec 15 prediction is generated and added**
- **Dec 9-14 predictions are preserved** (not regenerated)
- Result: Future predictions now span Dec 9-15 (7 days maintained)
- Past predictions (Dec 8, Dec 9) remain in database for historical comparison

---

## 6. Rolling 7-Day Window: How Predictions Are Maintained

### The Question: How Does the System Maintain 7 Days of Predictions?

You might wonder: "If we predicted prices for Dec 7-13 on Dec 6, and we get the actual price for Dec 7, does the system only predict Dec 14 to maintain 7 days of future predictions?"

**Answer: Yes, exactly!** The system maintains a rolling 7-day window of future predictions.

### How It Works

The system uses a **smart prediction generation logic** that:

1. **Checks existing predictions** before generating new ones
2. **Only generates predictions for missing dates**
3. **Preserves all existing predictions** (never overwrites)

### Detailed Example: Dec 6 → Dec 7 Transition

Let's trace exactly what happens:

#### **Dec 6 (12:30 PM) - Initial Prediction**

- System generates predictions for **next 7 days** starting from tomorrow (Dec 7)
- Predictions created: **Dec 7, 8, 9, 10, 11, 12, 13**
- Database now contains: 7 future predictions

#### **Dec 7 (9:00 AM) - Actual Price Scraped**

- Gold price scraper runs
- Actual price for Dec 7 is scraped and stored
- Prediction for Dec 7 remains unchanged in database

**Current state:**
- Past prediction: Dec 7 (has both predicted and actual)
- Future predictions: Dec 8, 9, 10, 11, 12, 13 (only 6 days left!)

#### **Dec 7 (12:30 PM) - News Scraper Runs**

The system now:

1. **Checks existing predictions:**
   ```typescript
   Existing predictions: Dec 7, 8, 9, 10, 11, 12, 13
   ```

2. **Calculates which dates need predictions:**
   ```typescript
   Tomorrow = Dec 8
   Next 7 days from tomorrow = Dec 8, 9, 10, 11, 12, 13, 14
   
   Missing dates = [Dec 14]  // Only Dec 14 doesn't exist yet
   ```

3. **System behavior:**
   - If all 7 dates (Dec 8-14) already exist → **Skips prediction generation entirely**
   - If some dates are missing (like Dec 14) → Generates predictions for next 7 days, but **only saves missing dates**

4. **Result:**
   - Dec 14 prediction is added
   - Predictions for Dec 8-13 are **preserved** (not regenerated)
   - Database now contains: **Dec 7-14 predictions** (8 total, but 7 future: Dec 8-14)

### Visual Timeline: Rolling Window in Action

```
┌─────────────────────────────────────────────────────────────────┐
│ DEC 6 (After 12:30 PM Prediction Generation)                    │
├─────────────────────────────────────────────────────────────────┤
│ Past: Dec 1-6 (actual prices)                                   │
│ Today: Dec 6 (actual price)                                     │
│ Future Predictions: Dec 7-13 (7 days) ✅                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ DEC 7 (After 9:00 AM Price Scraping)                            │
├─────────────────────────────────────────────────────────────────┤
│ Past: Dec 1-7 (actual prices)                                   │
│ Today: Dec 7 (actual + prediction available)                    │
│ Future Predictions: Dec 8-13 (only 6 days!) ⚠️                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ DEC 7 (After 12:30 PM News Scraping)                            │
├─────────────────────────────────────────────────────────────────┤
│ Past: Dec 1-7 (actual prices)                                   │
│ Today: Dec 7 (actual + prediction available)                    │
│ Future Predictions: Dec 8-14 (7 days again!) ✅                 │
│                                                                  │
│ → Dec 14 prediction was ADDED                                   │
│ → Dec 8-13 predictions were PRESERVED                           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ DEC 8 (After 9:00 AM Price Scraping)                            │
├─────────────────────────────────────────────────────────────────┤
│ Past: Dec 1-8 (actual prices)                                   │
│ Today: Dec 8 (actual + prediction available)                    │
│ Future Predictions: Dec 9-14 (only 6 days!) ⚠️                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ DEC 8 (After 12:30 PM News Scraping)                            │
├─────────────────────────────────────────────────────────────────┤
│ Past: Dec 1-8 (actual prices)                                   │
│ Today: Dec 8 (actual + prediction available)                    │
│ Future Predictions: Dec 9-15 (7 days again!) ✅                 │
│                                                                  │
│ → Dec 15 prediction was ADDED                                   │
│ → Dec 9-14 predictions were PRESERVED                           │
└─────────────────────────────────────────────────────────────────┘
```

### Key Logic in the Code

The system implements this in `server/services/scheduler.ts`:

```typescript
// Check existing prediction dates
const existingDates = await getExistingPredictionDates();
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(0, 0, 0, 0);

// Calculate which dates need predictions (next 7 days starting from tomorrow)
const datesNeeded: string[] = [];
for (let i = 0; i < 7; i++) {
  const date = new Date(tomorrow);
  date.setDate(tomorrow.getDate() + i);
  const dateStr = date.toISOString().split('T')[0];
  
  if (!existingDates.has(dateStr)) {
    datesNeeded.push(dateStr);  // Only add missing dates
  }
}

if (datesNeeded.length === 0) {
  console.log('All dates already have predictions. No new predictions needed.');
  return;  // Skip generation if all dates exist
}

console.log(`Generating predictions for ${datesNeeded.length} missing dates`);
```

Then when saving:

```typescript
// Save predictions - existing dates will be skipped automatically
await savePredictions(analysis);
// The savePredictions function checks existing dates and only inserts new ones
```

### Important Points About the Rolling Window

1. **Always Maintains 7 Days of Future Predictions**
   - The system ensures you always have predictions for the next 7 days
   - As each day passes, a new day is added to the end

2. **Predictions Are Never Regenerated**
   - Once a prediction exists for a date, it's never overwritten
   - Even if news changes, the original prediction is preserved
   - This maintains historical accuracy data

3. **Efficient Generation**
   - System only generates predictions for dates that don't exist
   - If all 7 future dates already have predictions, it skips generation entirely
   - This saves API costs and processing time

4. **What Gets Displayed**
   - Frontend shows: Past 7 days + Future 7 days
   - Past predictions (with actuals) help you see accuracy
   - Future predictions show what's coming

### Example: Maintaining 7 Days

```
Day 1: Predictions for Dec 7-13 (7 days)
Day 2: Dec 7 becomes "today" → Only Dec 14 needed → Predictions: Dec 8-14 (7 days)
Day 3: Dec 8 becomes "today" → Only Dec 15 needed → Predictions: Dec 9-15 (7 days)
Day 4: Dec 9 becomes "today" → Only Dec 16 needed → Predictions: Dec 10-16 (7 days)
... and so on
```

**The window "rolls forward" one day at a time, always maintaining 7 days of future predictions!**

---

## 7. Key Points to Understand

### ✅ **Predictions Are Preserved Forever**

- Once a prediction is made, it's never modified or deleted
- This allows you to see how accurate your predictions were
- Historical prediction data is valuable for improving the model

### ✅ **Actual Prices Are Separate**

- Actual prices are stored in `gold_prices` table
- They're matched with predictions by date when displaying
- One table stores "what we thought", another stores "what happened"

### ✅ **Automatic Matching by Date**

- The system automatically matches predictions and actuals by date
- If an actual price exists for a predicted date, both are shown on the chart
- If no actual price exists yet (future dates), only prediction is shown

### ✅ **No Automatic Updates to Predictions**

- Predictions are **never updated** when actual prices arrive
- They remain as a permanent record of what was predicted
- This is intentional - it preserves prediction accuracy data

### ✅ **Visual Comparison in Chart**

- **Past predictions** (orange dashed line): Dates where both prediction and actual exist
- **Actual prices** (blue solid line): Real prices that happened
- **Future predictions** (orange line): Dates where only prediction exists

---

## 8. Database Query Example

Here's how the system fetches combined data for the chart:

```sql
-- Get predictions
SELECT 
  predicted_date,
  predicted_price_1g,
  confidence
FROM gold_price_predictions
WHERE predicted_date >= '2024-12-01'
  AND predicted_date <= '2024-12-15'

-- Get actual prices  
SELECT 
  DATE(timestamp) as price_date,
  price_1g
FROM gold_prices
WHERE country = 'India'
  AND DATE(timestamp) >= '2024-12-01'
  AND DATE(timestamp) <= CURRENT_DATE

-- System joins them by date:
-- Date: 2024-12-08 → predicted: 6260, actual: 6255
-- Date: 2024-12-09 → predicted: 6270, actual: 6270
-- Date: 2024-12-10 → predicted: 6280, actual: NULL (not scraped yet)
```

---

## 9. Code Locations

If you want to see the implementation:

### Prediction Generation
- **File**: `server/services/predictionService.ts`
- **Function**: `generateGoldPricePredictions()`
- **Scheduler**: `server/services/scheduler.ts` → `performNewsScraping()`

### Prediction Storage
- **File**: `server/services/predictionService.ts`
- **Function**: `savePredictions()`
- **Database**: `gold_price_predictions` table

### Combining Predictions + Actuals
- **File**: `server/services/predictionService.ts`
- **Function**: `getAllPredictionsWithActuals()`
- **API Route**: `GET /api/predictions/combined`

### Frontend Display
- **File**: `src/components/PredictionComparison.tsx`
- **Function**: `fetchCombinedPredictions()`

### Accuracy Tracking (Optional)
- **File**: `server/services/accuracyTracking.ts`
- **Function**: `validatePredictions()`
- **Database**: `prediction_accuracy_tracking` table

---

## Summary

**In simple terms:**

1. **Today**: System predicts prices for next 7 days → stored in `gold_price_predictions`
2. **Tomorrow**: Actual price scraped → stored in `gold_prices` 
3. **Next Day**: System automatically adds one new day to maintain 7 future predictions (rolling window)
4. **Display**: System joins both tables by date → shows prediction vs actual on chart
5. **Result**: You can see how accurate your predictions were as time passes!

### Key Features:

- ✅ **Rolling 7-Day Window**: System always maintains exactly 7 days of future predictions
- ✅ **Preserves History**: Predictions are **never updated** - they remain as a historical record
- ✅ **Automatic Maintenance**: As each day passes, only the missing day is predicted (e.g., when Dec 7 passes, only Dec 14 is added)
- ✅ **Efficient**: Only generates predictions for dates that don't exist yet, saving resources

The predictions serve as a permanent record of what was predicted, allowing you to continuously evaluate and improve the prediction model's accuracy over time.

