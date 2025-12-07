import { TrendingUp, BarChart3, Clock, Bell } from 'lucide-react';
import type { CurrencyUnit } from '../utils/priceConverter';

interface NavigationProps {
  currencyUnit: CurrencyUnit;
  setCurrencyUnit: (unit: CurrencyUnit) => void;
}

export function Navigation({ currencyUnit, setCurrencyUnit }: NavigationProps) {
  return (
    <nav className="bg-black border-b border-slate-800 sticky top-0 z-50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 bg-gradient-to-br from-amber-400 to-amber-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <span className="text-white text-xl">Gold Tracker</span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <a href="#live" className="text-white hover:text-amber-100 transition-colors flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Live Prices</span>
            </a>
            <a href="#charts" className="text-white hover:text-amber-100 transition-colors flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Charts</span>
            </a>
            <a href="#history" className="text-white hover:text-amber-100 transition-colors flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>History</span>
            </a>
            
            {/* Currency Unit Selector */}
            <div className="flex items-center space-x-2 bg-slate-800 rounded-lg p-1 border border-slate-700">
              <button
                onClick={() => setCurrencyUnit('USD/oz')}
                className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                  currencyUnit === 'USD/oz'
                    ? 'bg-amber-500 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                USD/oz
              </button>
              <button
                onClick={() => setCurrencyUnit('INR/g')}
                className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                  currencyUnit === 'INR/g'
                    ? 'bg-amber-500 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                INR/g
              </button>
            </div>
            
            <button className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors flex items-center space-x-2">
              <Bell className="h-4 w-4" />
              <span>Set Alert</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}