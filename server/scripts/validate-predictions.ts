import { validatePredictions, getAccuracyMetrics } from '../services/accuracyTracking';

async function main() {
  console.log('🔍 Starting prediction validation...');
  
  try {
    // Validate all unvalidated predictions
    await validatePredictions();
    
    // Get accuracy metrics
    console.log('\n📊 Fetching accuracy metrics...');
    const metrics = await getAccuracyMetrics(30);
    
    console.log('\n✅ Validation Complete!');
    console.log('\n📈 Accuracy Metrics (Last 30 Days):');
    console.log(`  - Total Predictions: ${metrics.total_predictions}`);
    console.log(`  - Validated Predictions: ${metrics.validated_predictions}`);
    console.log(`  - Mean Absolute Error: ₹${metrics.mean_absolute_error.toFixed(2)}/g`);
    console.log(`  - Mean Absolute Percentage Error: ${metrics.mean_absolute_percentage_error.toFixed(2)}%`);
    console.log(`  - Root Mean Square Error: ₹${metrics.root_mean_square_error.toFixed(2)}/g`);
    console.log(`  - Direction Accuracy: ${metrics.direction_accuracy.toFixed(2)}%`);
    console.log(`  - Average Confidence: ${metrics.average_confidence.toFixed(2)}%`);
    
    if (metrics.accuracy_by_confidence.length > 0) {
      console.log('\n📊 Accuracy by Confidence Level:');
      metrics.accuracy_by_confidence.forEach(range => {
        console.log(`  - ${range.confidence_range}%: ${range.accuracy.toFixed(2)}% error (${range.count} predictions)`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  }
}

main();
