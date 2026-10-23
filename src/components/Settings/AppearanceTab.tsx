import React, { useState, useEffect } from 'react';
import { userApi } from '../../services/api';
import { Moon, Sun, Palette, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { applyAppearance, getStoredAppearance, AppearanceSettings } from '../../utils/theme';

const themeColors = [
  { name: 'Blue', value: 'blue', color: 'bg-blue-500' },
  { name: 'Green', value: 'green', color: 'bg-green-500' },
  { name: 'Purple', value: 'purple', color: 'bg-purple-500' },
  { name: 'Red', value: 'red', color: 'bg-red-500' },
  { name: 'Orange', value: 'orange', color: 'bg-orange-500' },
  { name: 'Pink', value: 'pink', color: 'bg-pink-500' },
];

const AppearanceTab: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [appearanceData, setAppearanceData] = useState<AppearanceSettings>(getStoredAppearance);

  // Initialize and synchronize appearance settings from backend on mount
  useEffect(() => {
    // 1. Immediately apply stored settings
    const initial = getStoredAppearance();
    applyAppearance(initial);
    setAppearanceData(initial);

    // 2. Sync with backend
    const syncBackendSettings = async () => {
      try {
        const data = await userApi.getSettings();
        const prefs = data.preferences || data.user || {};

        const backendSettings: AppearanceSettings = {
          darkMode: prefs.dark_mode !== undefined ? Boolean(prefs.dark_mode) : initial.darkMode,
          themeColor: prefs.theme_color || initial.themeColor || 'blue',
          compactMode: prefs.compact_mode !== undefined ? Boolean(prefs.compact_mode) : initial.compactMode,
        };

        setAppearanceData(backendSettings);
        applyAppearance(backendSettings);
      } catch (error) {
        console.error('Failed to sync appearance settings with backend:', error);
      } finally {
        setIsInitialLoading(false);
      }
    };

    syncBackendSettings();
  }, []);

  const handleToggle = async (field: 'darkMode' | 'compactMode') => {
    const updated: AppearanceSettings = {
      ...appearanceData,
      [field]: !appearanceData[field],
    };

    // Apply and update local state immediately
    setAppearanceData(updated);
    applyAppearance(updated);

    // Save to backend
    try {
      await userApi.updateSettings({
        preferences: {
          dark_mode: updated.darkMode,
          theme_color: updated.themeColor,
          compact_mode: updated.compactMode,
        },
      });
      toast.success(`${field === 'darkMode' ? 'Theme' : 'Layout'} updated!`);
    } catch (error) {
      console.error('Failed to save appearance setting:', error);
      toast.error('Failed to save setting to server');
      // Revert on error
      setAppearanceData(appearanceData);
      applyAppearance(appearanceData);
    }
  };

  const handleThemeChange = async (color: string) => {
    const updated: AppearanceSettings = {
      ...appearanceData,
      themeColor: color,
    };

    setAppearanceData(updated);
    applyAppearance(updated);

    try {
      await userApi.updateSettings({
        preferences: {
          dark_mode: updated.darkMode,
          theme_color: updated.themeColor,
          compact_mode: updated.compactMode,
        },
      });
      toast.success('Theme accent color updated!');
    } catch (error) {
      console.error('Failed to save theme color:', error);
      toast.error('Failed to save theme color to server');
      setAppearanceData(appearanceData);
      applyAppearance(appearanceData);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await userApi.updateSettings({
        preferences: {
          dark_mode: appearanceData.darkMode,
          theme_color: appearanceData.themeColor,
          compact_mode: appearanceData.compactMode,
        },
      });
      applyAppearance(appearanceData);
      toast.success('Appearance settings saved successfully!');
    } catch (error) {
      console.error('Failed to update appearance settings:', error);
      toast.error('Failed to save appearance settings');
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Appearance</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">Customize the visual styling, density, and accent color of your dashboard.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dark Mode Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center space-x-3">
            {appearanceData.darkMode ? (
              <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            ) : (
              <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            )}
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Dark Mode</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Switch between light and dark themes</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleToggle('darkMode')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              appearanceData.darkMode ? 'bg-blue-600' : 'bg-gray-200'
            }`}
            aria-label={appearanceData.darkMode ? 'Disable dark mode' : 'Enable dark mode'}
            title={appearanceData.darkMode ? 'Disable dark mode' : 'Enable dark mode'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                appearanceData.darkMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Theme Color Selection */}
        <div>
          <div className="flex items-center space-x-2 mb-4">
            <Palette className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Theme Accent Color</h4>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {themeColors.map((theme) => {
              const isSelected = appearanceData.themeColor === theme.value;
              return (
                <button
                  key={theme.value}
                  type="button"
                  onClick={() => handleThemeChange(theme.value)}
                  className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-gray-700 shadow-sm ring-2 ring-blue-500/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full ${theme.color} mb-2 shadow-sm`}></div>
                  <span className={`text-xs font-medium ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                    {theme.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Compact Mode */}
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div>
            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Compact Mode</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Reduce spacing, margins, and padding for a denser information display</p>
          </div>
          <button
            type="button"
            onClick={() => handleToggle('compactMode')}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              appearanceData.compactMode ? 'bg-blue-600' : 'bg-gray-200'
            }`}
            aria-label={appearanceData.compactMode ? 'Disable compact mode' : 'Enable compact mode'}
            title={appearanceData.compactMode ? 'Disable compact mode' : 'Enable compact mode'}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                appearanceData.compactMode ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Live Preview Section */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Live Appearance Preview</h4>
          <div className={`p-4 rounded-lg transition-all ${appearanceData.darkMode ? 'bg-gray-800 text-white border border-gray-700' : 'bg-white border border-gray-200'}`}>
            <div className="flex items-center space-x-3 mb-3">
              <div className={`w-3 h-3 rounded-full ${themeColors.find(t => t.value === appearanceData.themeColor)?.color}`}></div>
              <span className={`font-semibold ${appearanceData.compactMode ? 'text-xs' : 'text-sm'}`}>
                Sample Dashboard Card ({appearanceData.themeColor} theme)
              </span>
            </div>
            <p className={`${appearanceData.darkMode ? 'text-gray-300' : 'text-gray-600'} ${appearanceData.compactMode ? 'text-xs' : 'text-sm'}`}>
              This preview reflects your current theme color, dark mode toggle, and compact spacing mode.
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>{isLoading ? 'Saving...' : 'Save Appearance'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default AppearanceTab;
