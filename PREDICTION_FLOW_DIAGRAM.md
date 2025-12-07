# Prediction System Flow - Visual Diagram

## Simple Flow Chart

```
┌─────────────────────────────────────────────────────────────┐
│                    DAY 1: DEC 7, 2024                        │
└─────────────────────────────────────────────────────────────┘

9:00 AM - Gold Price Scraper Runs
    │
    ├─→ Scrapes actual price: ₹6,250/g
    │
    └─→ Stores in: gold_prices table
        {
          date: Dec 7,
          price_1g: 6250,
          timestamp: Dec 7, 9:00 AM
        }

12:30 PM - News Scraper Runs → Triggers Prediction Generation
    │
    ├─→ Collects: Latest prices, markets, news, Bitcoin
    │
    ├─→ Sends to OpenAI for analysis
    │
    └─→ Generates predictions for NEXT 7 DAYS
        Stores in: gold_price_predictions table
        {
          {date: Dec 8, predicted_price_1g: 6260},
          {date: Dec 9, predicted_price_1g: 6270},
          {date: Dec 10, predicted_price_1g: 6280},
          ... (Dec 11-14)
        }

FRONTEND DISPLAY:
    Past Prices (Blue Line): Dec 7 = ₹6,250 ✅
    Future Predictions (Orange Line): Dec 8-14 = ₹6,260-6,340 ⚠️


┌─────────────────────────────────────────────────────────────┐
│                    DAY 2: DEC 8, 2024                        │
└─────────────────────────────────────────────────────────────┘

9:00 AM - Gold Price Scraper Runs
    │
    ├─→ Scrapes actual price: ₹6,255/g
    │
    └─→ Stores in: gold_prices table
        {
          date: Dec 8,
          price_1g: 6255,          ← NEW ACTUAL PRICE
          timestamp: Dec 8, 9:00 AM
        }

PREDICTION STATUS:
    ❌ Prediction for Dec 8 is NOT modified
    ✅ Still shows: predicted_price_1g: 6260 (from yesterday)
    ✅ New actual price: 6255 (stored separately)

FRONTEND DISPLAY:
    Past Prices (Blue Line): 
      Dec 7 = ₹6,250 ✅
      Dec 8 = ₹6,255 ✅ (NEW!)
    
    Past Predictions (Orange Dashed Line):
      Dec 8 = ₹6,260 ⚠️ (Predicted too high by ₹5)
    
    Future Predictions (Orange Line):
      Dec 9-14 = ₹6,270-6,340 ⚠️

12:30 PM - News Scraper Runs → New Predictions
    │
    ├─→ Checks existing predictions: Dec 8-13 already exist
    │
    ├─→ Calculates missing dates: Only Dec 14 is needed
    │
    └─→ Generates predictions for next 7 days, but only saves Dec 14
        (Dec 8-13 predictions are PRESERVED, not regenerated)
    
    Result: Future predictions now Dec 8-14 (7 days maintained!)


┌─────────────────────────────────────────────────────────────┐
│                    DAY 3: DEC 9, 2024                        │
└─────────────────────────────────────────────────────────────┘

9:00 AM - Gold Price Scraper Runs
    │
    └─→ Stores actual: Dec 9 = ₹6,270/g

FRONTEND DISPLAY:
    Past Prices (Blue Line): 
      Dec 7 = ₹6,250 ✅
      Dec 8 = ₹6,255 ✅
      Dec 9 = ₹6,270 ✅ (NEW!)
    
    Past Predictions (Orange Dashed Line):
      Dec 8 = ₹6,260 ⚠️ (Error: +₹5)
      Dec 9 = ₹6,270 ✅ (Perfect match!)
    
    Future Predictions (Orange Line):
      Dec 10-14 = ₹6,280-6,340 ⚠️


┌─────────────────────────────────────────────────────────────┐
│              DATABASE STATE (After Day 3)                    │
└─────────────────────────────────────────────────────────────┘

gold_prices table (Actual Prices):
┌──────────┬─────────────┬──────────────┐
│   Date   │ price_1g    │  timestamp   │
├──────────┼─────────────┼──────────────┤
│ Dec 7    │  6250.00    │  Dec 7 9AM   │
│ Dec 8    │  6255.00    │  Dec 8 9AM   │
│ Dec 9    │  6270.00    │  Dec 9 9AM   │
└──────────┴─────────────┴──────────────┘

gold_price_predictions table (Predictions):
┌──────────┬──────────────┬──────────────┬─────────────┐
│   Date   │ predicted_1g │  confidence  │ created_at  │
├──────────┼──────────────┼──────────────┼─────────────┤
│ Dec 8    │  6260.00     │     85%      │  Dec 7 1PM  │
│ Dec 9    │  6270.00     │     82%      │  Dec 7 1PM  │
│ Dec 10   │  6280.00     │     80%      │  Dec 7 1PM  │
│ Dec 11   │  6290.00     │     78%      │  Dec 7 1PM  │
│ ...      │  ...         │     ...      │  ...        │
└──────────┴──────────────┴──────────────┴─────────────┘

CHART JOINS THEM BY DATE:
┌──────────┬──────────────┬─────────────┬──────────┐
│   Date   │  Predicted   │   Actual    │  Error   │
├──────────┼──────────────┼─────────────┼──────────┤
│ Dec 8    │  6260.00     │  6255.00    │  +₹5     │
│ Dec 9    │  6270.00     │  6270.00    │  ₹0 ✅   │
│ Dec 10   │  6280.00     │   NULL      │  N/A     │
│ Dec 11   │  6290.00     │   NULL      │  N/A     │
└──────────┴──────────────┴─────────────┴──────────┘
```

---

## Key Database Tables Relationship

```
┌─────────────────────────┐
│   gold_prices           │
│   (Actual Prices)       │
├─────────────────────────┤
│ • date: Dec 7          │
│ • price_1g: 6250       │
│ • timestamp: Dec 7 AM  │
│                         │
│ • date: Dec 8          │
│ • price_1g: 6255       │
│ • timestamp: Dec 8 AM  │
└─────────────────────────┘
           │
           │ JOIN BY DATE
           │
           ▼
┌─────────────────────────┐
│ gold_price_predictions  │
│   (Predictions)         │
├─────────────────────────┤
│ • date: Dec 8          │
│ • predicted_1g: 6260   │
│ • created: Dec 7 PM    │
│                         │
│ • date: Dec 9          │
│ • predicted_1g: 6270   │
│ • created: Dec 7 PM    │
└─────────────────────────┘
           │
           │
           ▼
┌─────────────────────────┐
│   Combined Result       │
│   (for Chart Display)   │
├─────────────────────────┤
│ Dec 8:                  │
│   predicted: 6260       │
│   actual: 6255          │
│   error: +₹5            │
│                         │
│ Dec 9:                  │
│   predicted: 6270       │
│   actual: 6270          │
│   error: ₹0 ✅          │
└─────────────────────────┘
```

---

## Important Rules

### ✅ What Happens

1. **Predictions are generated** → Stored in `gold_price_predictions`
2. **Actual prices are scraped daily** → Stored in `gold_prices`
3. **Both tables exist independently**
4. **Frontend joins them by date** when displaying chart
5. **Predictions are NEVER updated** when actuals arrive

### ❌ What Does NOT Happen

1. ❌ Predictions are NOT deleted when actual prices arrive
2. ❌ Predictions are NOT modified when actual prices arrive
3. ❌ Old predictions are NOT replaced by new predictions (for same date)
4. ❌ System does NOT automatically validate accuracy (optional feature)

---

## Answer to Your Question

> "If we predicted pricing for next 7 days from today, what happens when we get the real price for the next day?"

**Answer:**

1. ✅ **The actual price is stored** in `gold_prices` table
2. ✅ **The prediction remains unchanged** in `gold_price_predictions` table
3. ✅ **Both are shown on the chart** - you can see the prediction vs actual
4. ✅ **The error is calculated** (difference between predicted and actual)
5. ✅ **Historical comparison is preserved** - you can always see what was predicted vs what happened

**The prediction is a permanent record** - it doesn't disappear or change when the actual price arrives. This allows you to evaluate prediction accuracy over time!

---

## Rolling 7-Day Window Explained

### How the System Maintains 7 Days of Future Predictions

The system uses a **rolling window** approach to always maintain exactly 7 days of future predictions:

```
DAY 1 (Dec 6):
  After prediction: Dec 7-13 (7 future days) ✅

DAY 2 (Dec 7):
  Morning: Actual price scraped for Dec 7
  State: Dec 8-13 (only 6 future days) ⚠️
  Afternoon: News scraper adds Dec 14
  State: Dec 8-14 (7 future days again!) ✅

DAY 3 (Dec 8):
  Morning: Actual price scraped for Dec 8
  State: Dec 9-14 (only 6 future days) ⚠️
  Afternoon: News scraper adds Dec 15
  State: Dec 9-15 (7 future days again!) ✅

... and so on
```

### The Logic

1. **Before generating predictions**, system checks which dates already have predictions
2. **Only missing dates** get new predictions generated
3. **Existing predictions are never overwritten** - they're preserved forever
4. **The window "rolls forward"** - one new day is added as each day passes

### Example: Dec 7 Transition

```
EXISTING PREDICTIONS (Dec 7 morning):
  Dec 7: ✅ (prediction exists, now has actual too)
  Dec 8: ✅ (prediction exists)
  Dec 9: ✅ (prediction exists)
  Dec 10: ✅ (prediction exists)
  Dec 11: ✅ (prediction exists)
  Dec 12: ✅ (prediction exists)
  Dec 13: ✅ (prediction exists)
  Dec 14: ❌ (no prediction yet)

WHAT SYSTEM DOES:
  1. Calculates: Next 7 days from tomorrow (Dec 8) = Dec 8-14
  2. Checks: Dec 8-13 already exist, only Dec 14 is missing
  3. Generates: Predictions for Dec 8-14 (but only saves Dec 14)
  4. Result: Now has Dec 8-14 (7 future days) ✅
```

**The system always maintains 7 days of future predictions by adding only the missing day!**

