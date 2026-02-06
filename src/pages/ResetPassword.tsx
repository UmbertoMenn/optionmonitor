import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Lock, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event from the magic link
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event, 'Session:', !!session);
        
        if (event === 'PASSWORD_RECOVERY') {
          // User clicked the recovery link and is now in recovery mode
          setLoading(false);
          setError(null);
        } else if (event === 'SIGNED_IN' && session) {
          // Check if this is a recovery session by looking at the URL hash
          const hash = window.location.hash;
          if (hash.includes('type=recovery')) {
            setLoading(false);
            setError(null);
          } else {
            // Already logged in normally, redirect to home
            navigate('/');
          }
        }
      }
    );

    // Also check current session - might already be in recovery mode
    const checkInitialState = async () => {
      const hash = window.location.hash;
      
      // If there's a recovery token in the URL, wait for the auth event
      if (hash.includes('access_token') && hash.includes('type=recovery')) {
        // The onAuthStateChange will handle this
        return;
      }
      
      // Check if already has a valid session (from recovery)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Has valid session, allow password change
        setLoading(false);
      } else {
        // No session and no recovery token
        setLoading(false);
        setError('Link di reset non valido o scaduto. Richiedi un nuovo link.');
      }
    };

    // Small delay to allow auth state change to fire first
    const timer = setTimeout(checkInitialState, 500);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, [navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Le password non coincidono');
      return;
    }

    if (password.length < 6) {
      toast.error('La password deve essere di almeno 6 caratteri');
      return;
    }

    setSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        toast.error('Errore nel reset della password', {
          description: error.message,
        });
      } else {
        setSuccess(true);
        toast.success('Password aggiornata con successo!');
        
        // Redirect to home after 2 seconds
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (err) {
      toast.error('Errore imprevisto');
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Verifica link in corso...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-destructive/10 border border-destructive/20 mb-4 mx-auto">
              <Lock className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>Link non valido</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/')} 
              className="w-full bg-primary hover:bg-primary-glow"
            >
              Torna al login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border/50 bg-card/80 backdrop-blur">
          <CardHeader className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-success/10 border border-success/20 mb-4 mx-auto">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <CardTitle>Password aggiornata!</CardTitle>
            <CardDescription>Verrai reindirizzato alla home...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 mb-4">
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Nuova Password</h1>
          <p className="text-muted-foreground">Inserisci la tua nuova password</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur">
          <CardContent className="pt-6">
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nuova Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-background-secondary border-border"
                    minLength={6}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">Minimo 6 caratteri</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Conferma Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 bg-background-secondary border-border"
                    minLength={6}
                    required
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary-glow transition-all hover:shadow-glow-primary"
                disabled={submitting}
              >
                {submitting ? 'Aggiornamento...' : 'Aggiorna Password'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
