import pool from '../db/connection';
import { getLatestPrice } from './priceService';
import { PricePrediction } from './predictionService';

export interface AccuracyMetrics {
  total_predictions: number;
  validated_predictions: number;
  mean_absolute_error: number;
  mean_absolute_percentage_error: number;
  root_mean_square_error: number;
  direction_accuracy: number;
  average_confidence: number;
  accuracy_by_confidence: Array<{ confidence_range: string; accuracy: number; count: number }>;
}

/**
 * Validate predictions by comparing with actual prices
 */
export async function validatePredictions(): Promise<void> {
  const client = await pool.connect();
  try {
    // Get all predictions that haven't been validated yet
    const predictionsResult = await client.query(
      `SELECT predicted_date, predicted_price_1g, confidence, factors
       FROM gold_price_predictions
       WHERE predicted_date <= CURRENT_DATE
         AND predicted_date >= CURRENT_DATE - INTERVAL '7 days'
         AND predicted_date NOT IN (
           SELECT prediction_date FROM prediction_accuracy_tracking WHERE validated_at IS NOT NULL
         )
       ORDER BY predicted_date ASC`
    );

    for (const pred of predictionsResult.rows) {
      const predDate = new Date(pred.predicted_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      predDate.setHours(0, 0, 0, 0);

      // Only validate past predictions
      if (predDate >= today) continue;

      // Get actual price for the prediction date
      const actualPriceResult = await client.query(
        `SELECT price_1g, timestamp
         FROM gold_prices
         WHERE country = 'India'
           AND DATE(timestamp) = $1
         ORDER BY timestamp DESC
         LIMIT 1`,
        [predDate]
      );

      if (actualPriceResult.rows.length === 0) {
        console.log(`⚠️  No actual price found for ${predDate.toISOString().split('T')[0]}, skipping validation`);
        continue;
      }

      const actualPrice = parseFloat(actualPriceResult.rows[0].price_1g);
      const predictedPrice = parseFloat(pred.predicted_price_1g);
      
      // Calculate errors
      const errorAmount = actualPrice - predictedPrice;
      const absoluteError = Math.abs(errorAmount);
      const errorPercentage = (absoluteError / actualPrice) * 100;

      // Determine if direction was correct
      // Get price from previous day to determine direction
      const previousDay = new Date(predDate);
      previousDay.setDate(previousDay.getDate() - 1);
      
      const previousPriceResult = await client.query(
        `SELECT price_1g
         FROM gold_prices
         WHERE country = 'India'
           AND DATE(timestamp) = $1
         ORDER BY timestamp DESC
         LIMIT 1`,
        [previousDay]
      );

      let directionCorrect: boolean | null = null;
      if (previousPriceResult.rows.length > 0) {
        const previousPrice = parseFloat(previousPriceResult.rows[0].price_1g);
        const actualDirection = actualPrice > previousPrice ? 'up' : actualPrice < previousPrice ? 'down' : 'neutral';
        const predictedDirection = predictedPrice > previousPrice ? 'up' : predictedPrice < previousPrice ? 'down' : 'neutral';
        directionCorrect = actualDirection === predictedDirection;
      }

      // Save accuracy tracking record
      await client.query(
        `INSERT INTO prediction_accuracy_tracking
         (prediction_date, predicted_price_1g, actual_price_1g, error_amount, 
          error_percentage, absolute_error, direction_correct, confidence_score, 
          factors_used, validated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
         ON CONFLICT (prediction_date)
         DO UPDATE SET
           actual_price_1g = EXCLUDED.actual_price_1g,
           error_amount = EXCLUDED.error_amount,
           error_percentage = EXCLUDED.error_percentage,
           absolute_error = EXCLUDED.absolute_error,
           direction_correct = EXCLUDED.direction_correct,
           validated_at = NOW()`,
        [
          predDate,
          predictedPrice,
          actualPrice,
          errorAmount,
          errorPercentage,
          absoluteError,
          directionCorrect,
          parseFloat(pred.confidence) || 0,
          pred.factors || '[]'
        ]
      );

      console.log(`✅ Validated prediction for ${predDate.toISOString().split('T')[0]}: Error ${errorPercentage.toFixed(2)}%`);
    }
  } finally {
    client.release();
  }
}

/**
 * Get accuracy metrics
 */
export async function getAccuracyMetrics(days: number = 30): Promise<AccuracyMetrics> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        COUNT(*) as total_predictions,
        COUNT(actual_price_1g) as validated_predictions,
        AVG(absolute_error) as mean_absolute_error,
        AVG(error_percentage) as mean_absolute_percentage_error,
        SQRT(AVG(POWER(absolute_error, 2))) as root_mean_square_error,
        AVG(CASE WHEN direction_correct THEN 100.0 ELSE 0.0 END) as direction_accuracy,
        AVG(confidence_score) as average_confidence
       FROM prediction_accuracy_tracking
       WHERE validated_at IS NOT NULL
         AND validated_at >= CURRENT_DATE - INTERVAL '${days} days'`
    );

    const row = result.rows[0];
    
    // Get accuracy by confidence ranges
    const confidenceRanges = await client.query(
      `SELECT 
        CASE 
          WHEN confidence_score >= 80 THEN '80-100'
          WHEN confidence_score >= 60 THEN '60-79'
          WHEN confidence_score >= 40 THEN '40-59'
          ELSE '0-39'
        END as confidence_range,
        AVG(error_percentage) as accuracy,
        COUNT(*) as count
       FROM prediction_accuracy_tracking
       WHERE validated_at IS NOT NULL
         AND validated_at >= CURRENT_DATE - INTERVAL '${days} days'
       GROUP BY confidence_range
       ORDER BY confidence_range DESC`
    );

    return {
      total_predictions: parseInt(row.total_predictions) || 0,
      validated_predictions: parseInt(row.validated_predictions) || 0,
      mean_absolute_error: parseFloat(row.mean_absolute_error) || 0,
      mean_absolute_percentage_error: parseFloat(row.mean_absolute_percentage_error) || 0,
      root_mean_square_error: parseFloat(row.root_mean_square_error) || 0,
      direction_accuracy: parseFloat(row.direction_accuracy) || 0,
      average_confidence: parseFloat(row.average_confidence) || 0,
      accuracy_by_confidence: confidenceRanges.rows.map(r => ({
        confidence_range: r.confidence_range,
        accuracy: parseFloat(r.accuracy) || 0,
        count: parseInt(r.count) || 0
      }))
    };
  } finally {
    client.release();
  }
}

/**
 * Get recent accuracy tracking records
 */
export async function getRecentAccuracyRecords(limit: number = 10) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT *
       FROM prediction_accuracy_tracking
       WHERE validated_at IS NOT NULL
       ORDER BY validated_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } finally {
    client.release();
  }
}
