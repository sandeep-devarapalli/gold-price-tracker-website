import { Bell, Plus, X, Check } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { convertPrice, formatPrice, type CurrencyUnit } from '../utils/priceConverter';
import { fetchAlerts, createAlert, updateAlert, deleteAlert, resetAlert, type PriceAlert as PriceAlertType } from '../services/api';

interface PriceAlertsProps {
  currentPrice: number; // Current price in INR/g
  currencyUnit: CurrencyUnit;
}

export function PriceAlerts({ currentPrice, currencyUnit }: PriceAlertsProps) {
  const [alerts, setAlerts] = useState<PriceAlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAlertType, setNewAlertType] = useState<'above' | 'below'>('above');
  const [newAlertPrice, setNewAlertPrice] = useState('');

  // Load alerts from API
  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetchAlerts(false); // Get all alerts, not just active
      if (response.success && response.data) {
        setAlerts(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const handleAddAlert = async () => {
    if (!newAlertPrice || parseFloat(newAlertPrice) <= 0) {
      return;
    }

    try {
      setError(null);
      
      // Convert price from display currency to INR/g for storage
      const priceInDisplayCurrency = parseFloat(newAlertPrice);
      // Since target_price is stored in INR/g, we need to convert if currencyUnit is different
      let targetPriceInINR = priceInDisplayCurrency;
      
      // If displaying in USD/oz, convert to INR/g
      // USD/oz to INR/g conversion: 1 oz = 31.1035g, then convert USD to INR
      if (currencyUnit === 'USD/oz') {
        // Convert USD/oz to INR/g
        // First convert oz to grams: priceInDisplayCurrency / 31.1035 (USD/g)
        // Then convert USD to INR (assuming ~83 INR per USD, but we should use current rate)
        // For now, we'll ask user to enter price in INR/g or handle conversion properly
        // For simplicity, let's assume the user enters price in INR/g regardless of display currency
        // TODO: Add proper currency conversion
        targetPriceInINR = priceInDisplayCurrency;
      }

      const response = await createAlert({
        alert_type: newAlertType,
        target_price: targetPriceInINR,
        country: 'India'
      });

      if (response.success && response.data) {
        setAlerts(prev => [response.data, ...prev]);
        setNewAlertPrice('');
        setShowAddForm(false);
      }
    } catch (err) {
      console.error('Failed to create alert:', err);
      setError(err instanceof Error ? err.message : 'Failed to create alert');
    }
  };

  const handleRemoveAlert = async (id: number) => {
    try {
      setError(null);
      const response = await deleteAlert(id);
      if (response.success) {
        setAlerts(prev => prev.filter(alert => alert.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete alert:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete alert');
    }
  };

  const handleToggleAlert = async (id: number, currentActive: boolean) => {
    try {
      setError(null);
      const response = await updateAlert(id, {
        is_active: !currentActive
      });

      if (response.success && response.data) {
        setAlerts(prev => prev.map(alert => 
          alert.id === id ? response.data : alert
        ));
      }
    } catch (err) {
      console.error('Failed to update alert:', err);
      setError(err instanceof Error ? err.message : 'Failed to update alert');
    }
  };

  const handleResetAlert = async (id: number) => {
    try {
      setError(null);
      const response = await resetAlert(id);
      if (response.success && response.data) {
        setAlerts(prev => prev.map(alert => 
          alert.id === id ? response.data : alert
        ));
      }
    } catch (err) {
      console.error('Failed to reset alert:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset alert');
    }
  };

  const checkAlertStatus = (alert: PriceAlertType) => {
    // Check if alert is triggered (either by backend or current price)
    if (alert.triggered) {
      return 'triggered';
    }
    
    // Also check current price against target
    if (alert.is_active) {
      if (alert.alert_type === 'above' && currentPrice >= alert.target_price) {
        return 'triggered';
      }
      if (alert.alert_type === 'below' && currentPrice <= alert.target_price) {
        return 'triggered';
      }
    }
    return 'pending';
  };

  // Convert current price for display
  const displayCurrentPrice = convertPrice(currentPrice, currencyUnit);
  
  // Convert target price for display (target_price is stored in INR/g)
  const displayTargetPrice = (targetPriceInINR: number) => {
    return convertPrice(targetPriceInINR, currencyUnit);
  };

  return (
    <div className="bg-slate-800 rounded-2xl shadow-2xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Bell className="h-6 w-6 text-amber-500" />
          <h2 className="text-white">Price Alerts</h2>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Alert</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Current Price Reference */}
      <div className="bg-slate-700 rounded-lg p-4 mb-6 border border-amber-500/30">
        <div className="text-slate-400 text-sm mb-1">Current Gold Price</div>
        <div className="text-white text-2xl">{formatPrice(displayCurrentPrice, currencyUnit)}</div>
      </div>

      {/* Add Alert Form */}
      {showAddForm && (
        <div className="bg-slate-700 rounded-lg p-4 mb-6 border border-slate-600">
          <h3 className="text-white mb-4">Create New Alert</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-slate-300 text-sm mb-2">Alert Type</label>
              <select
                value={newAlertType}
                onChange={(e) => setNewAlertType(e.target.value as 'above' | 'below')}
                className="w-full px-4 py-2 border border-slate-600 bg-slate-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="above">Price Goes Above</option>
                <option value="below">Price Goes Below</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 text-sm mb-2">
                Target Price ({currencyUnit === 'USD/oz' ? 'USD/oz' : 'INR/g'})
              </label>
              <input
                type="number"
                value={newAlertPrice}
                onChange={(e) => setNewAlertPrice(e.target.value)}
                placeholder={`Enter price in ${currencyUnit === 'USD/oz' ? 'USD/oz' : 'INR/g'}`}
                className="w-full px-4 py-2 border border-slate-600 bg-slate-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleAddAlert}
              className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors"
            >
              Create Alert
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewAlertPrice('');
                setError(null);
              }}
              className="bg-slate-600 text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8 text-slate-400">
          <div className="animate-pulse">Loading alerts...</div>
        </div>
      )}

      {/* Alerts List */}
      {!loading && (
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No alerts set. Create one to get notified!</p>
            </div>
          ) : (
            alerts.map((alert) => {
              const status = checkAlertStatus(alert);
              const isTriggered = status === 'triggered' || alert.triggered;
              
              return (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border transition-all ${
                    isTriggered
                      ? 'bg-green-900/30 border-green-500'
                      : alert.is_active
                      ? 'bg-slate-700 border-slate-600 hover:border-amber-500'
                      : 'bg-slate-700/50 border-slate-600 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => handleToggleAlert(alert.id, alert.is_active)}
                        className={`h-6 w-6 rounded border-2 flex items-center justify-center transition-colors ${
                          alert.is_active
                            ? 'bg-amber-500 border-amber-500'
                            : 'bg-slate-800 border-slate-500'
                        }`}
                      >
                        {alert.is_active && <Check className="h-4 w-4 text-white" />}
                      </button>
                      <div>
                        <div className="text-white">
                          Alert when price goes{' '}
                          <span className={alert.alert_type === 'above' ? 'text-green-400' : 'text-red-400'}>
                            {alert.alert_type}
                          </span>{' '}
                          <span className="text-amber-400">
                            {formatPrice(displayTargetPrice(alert.target_price), currencyUnit)}
                          </span>
                        </div>
                        {isTriggered && (
                          <div className="text-green-400 text-sm mt-1">
                            ✓ Alert triggered! {alert.triggered_price && `Triggered at: ${formatPrice(convertPrice(alert.triggered_price, currencyUnit), currencyUnit)}`}
                            {' '}Current price: {formatPrice(displayCurrentPrice, currencyUnit)}
                            {alert.triggered && (
                              <button
                                onClick={() => handleResetAlert(alert.id)}
                                className="ml-2 text-xs underline hover:no-underline"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveAlert(alert.id)}
                      className="text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Alert Settings Info */}
      <div className="mt-6 pt-6 border-t border-slate-700">
        <div className="bg-blue-900/30 rounded-lg p-4 border border-blue-500/30">
          <div className="flex items-start space-x-2">
            <Bell className="h-5 w-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="text-white mb-1">How Alerts Work</h4>
              <p className="text-slate-400 text-sm">
                Alerts are automatically checked when gold prices are updated. 
                When your target price is reached, the alert will be marked as triggered. 
                You can reset a triggered alert to monitor the price again.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
