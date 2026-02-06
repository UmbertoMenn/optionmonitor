import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NotificationSettings {
  notify_email: boolean;
  notify_telegram: boolean;
  telegram_chat_id: string | null;
}

interface TelegramLinkCode {
  code: string;
  expires_at: string;
}

export function useNotificationSettings() {
  const { user, session } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>({
    notify_email: true,
    notify_telegram: false,
    telegram_chat_id: null,
  });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [linkCode, setLinkCode] = useState<TelegramLinkCode | null>(null);
  const [generatingCode, setGeneratingCode] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notify_email, notify_telegram, telegram_chat_id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          notify_email: data.notify_email ?? true,
          notify_telegram: data.notify_telegram ?? false,
          telegram_chat_id: data.telegram_chat_id,
        });
      }
    } catch (error) {
      console.error('Error fetching notification settings:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSetting = async (key: 'notify_email' | 'notify_telegram', value: boolean) => {
    if (!user) return;

    // Can't enable telegram without chat_id
    if (key === 'notify_telegram' && value && !settings.telegram_chat_id) {
      toast({
        title: 'Collega Telegram prima',
        description: 'Devi collegare il tuo account Telegram prima di abilitare le notifiche.',
        variant: 'destructive',
      });
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [key]: value })
        .eq('user_id', user.id);

      if (error) throw error;

      setSettings(prev => ({ ...prev, [key]: value }));
      
      toast({
        title: 'Impostazioni aggiornate',
        description: `Notifiche ${key === 'notify_email' ? 'email' : 'Telegram'} ${value ? 'abilitate' : 'disabilitate'}.`,
      });
    } catch (error) {
      console.error('Error updating setting:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile aggiornare le impostazioni.',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const generateLinkCode = async () => {
    if (!session?.access_token) return;

    setGeneratingCode(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-link/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate code');
      }

      const data = await response.json();
      setLinkCode(data);
    } catch (error) {
      console.error('Error generating link code:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile generare il codice di collegamento.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingCode(false);
    }
  };

  const unlinkTelegram = async () => {
    if (!session?.access_token) return;

    setUpdating(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-link/unlink`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to unlink');
      }

      setSettings(prev => ({
        ...prev,
        notify_telegram: false,
        telegram_chat_id: null,
      }));
      setLinkCode(null);

      toast({
        title: 'Telegram scollegato',
        description: 'Il tuo account Telegram è stato scollegato.',
      });
    } catch (error) {
      console.error('Error unlinking Telegram:', error);
      toast({
        title: 'Errore',
        description: 'Impossibile scollegare Telegram.',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  };

  const refreshSettings = () => {
    setLoading(true);
    fetchSettings();
  };

  return {
    settings,
    loading,
    updating,
    linkCode,
    generatingCode,
    updateSetting,
    generateLinkCode,
    unlinkTelegram,
    refreshSettings,
    isTelegramLinked: !!settings.telegram_chat_id,
  };
}
