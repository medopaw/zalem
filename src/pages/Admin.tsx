import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Key, Save, AlertCircle } from 'lucide-react';

function Admin() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'deepseek_api_key')
      .single();

    if (!error && data) {
      setApiKey(data.value);
    }
    setLoading(false);
  };

  const saveApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert(
          {
            key: 'deepseek_api_key',
            value: apiKey,
            is_encrypted: true,
          },
          {
            onConflict: 'key',
          }
        );

      if (error) throw error;

      setMessage({
        type: 'success',
        text: 'API key saved successfully',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to save API key',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-sm rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            API Settings
          </h3>
          <div className="mt-2 max-w-xl text-sm text-gray-500">
            <p>Configure your DeepSeek API credentials for the chat interface.</p>
          </div>
          <form onSubmit={saveApiKey} className="mt-5">
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="apiKey"
                  className="block text-sm font-medium text-gray-700"
                >
                  DeepSeek API Key
                </label>
                <div className="mt-1 flex rounded-md shadow-sm">
                  <div className="relative flex items-stretch flex-grow focus-within:z-10">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Key className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      name="apiKey"
                      id="apiKey"
                      className="block w-full rounded-md border-gray-300 pl-10 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Enter your DeepSeek API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                    />
                  </div>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Your API key will be encrypted before storage.
                </p>
              </div>

              {message && (
                <div
                  className={`rounded-md ${
                    message.type === 'success' ? 'bg-green-50' : 'bg-red-50'
                  } p-4`}
                >
                  <div className="flex">
                    <div className="flex-shrink-0">
                      <AlertCircle
                        className={`h-5 w-5 ${
                          message.type === 'success'
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      />
                    </div>
                    <div className="ml-3">
                      <p
                        className={`text-sm ${
                          message.type === 'success'
                            ? 'text-green-800'
                            : 'text-red-800'
                        }`}
                      >
                        {message.text}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {loading ? (
                    'Saving...'
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save API Key
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Admin;