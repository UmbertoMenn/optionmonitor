import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AlertPayload {
  alert_id: string;
  user_id: string;
  ticker: string;
  message: string;
  severity: string;
  alert_type: string;
  portfolio_id?: string;
}

interface Profile {
  email: string;
  full_name: string | null;
  notify_email: boolean;
  notify_telegram: boolean;
  telegram_chat_id: string | null;
  user_id: string;
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

async function sendEmail(
  email: string,
  alertData: AlertPayload,
  isAdmin: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const severityColor = alertData.severity === "critical" ? "#dc2626" : 
                          alertData.severity === "warning" ? "#f59e0b" : "#3b82f6";
    
    const adminPrefix = isAdmin ? "[ADMIN] " : "";
    
    await resend.emails.send({
      from: "Portfolio Alerts <noreply@resend.dev>",
      to: [email],
      subject: `${adminPrefix}⚠️ Avviso Portfolio: ${alertData.ticker}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${severityColor}; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
            <h2 style="margin: 0;">⚠️ ${adminPrefix}Avviso Portfolio: ${alertData.ticker}</h2>
          </div>
          <div style="padding: 20px; background: #f9fafb; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="font-size: 16px; color: #111827; margin-top: 0;">${alertData.message}</p>
            <table style="margin-top: 16px; width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Severità:</td>
                <td style="padding: 8px 0;"><strong style="color: ${severityColor};">${alertData.severity.toUpperCase()}</strong></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Tipo Alert:</td>
                <td style="padding: 8px 0;">${alertData.alert_type.replace(/_/g, ' ')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Data:</td>
                <td style="padding: 8px 0;">${new Date().toLocaleString('it-IT')}</td>
              </tr>
            </table>
          </div>
        </div>
      `,
    });
    
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Email send error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function sendTelegram(
  chatId: string,
  alertData: AlertPayload,
  isAdmin: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const severityEmoji = alertData.severity === "critical" ? "🔴" : 
                          alertData.severity === "warning" ? "🟡" : "🔵";
    
    const adminPrefix = isAdmin ? "*[ADMIN]* " : "";
    
    const text = `🚨 ${adminPrefix}*Avviso Portfolio*

📈 *Ticker:* ${alertData.ticker}
${severityEmoji} *Severità:* ${alertData.severity.toUpperCase()}
📝 *Messaggio:* ${alertData.message}
🏷️ *Tipo:* ${alertData.alert_type.replace(/_/g, ' ')}
📅 *Data:* ${new Date().toLocaleString('it-IT')}`;

    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "Markdown",
        }),
      }
    );
    
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.description || "Telegram API error");
    }
    
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Telegram send error:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function logNotification(
  supabase: ReturnType<typeof createClient>,
  alertId: string,
  userId: string,
  channel: "email" | "telegram",
  status: "sent" | "failed",
  errorMessage?: string
) {
  await supabase.from("notification_logs").insert({
    alert_id: alertId,
    user_id: userId,
    channel,
    status,
    error_message: errorMessage,
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const alertData: AlertPayload = await req.json();
    console.log("Received alert:", alertData);

    // 1. Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("email, full_name, notify_email, notify_telegram, telegram_chat_id, user_id")
      .eq("user_id", alertData.user_id)
      .single();

    if (profileError || !userProfile) {
      console.error("Profile fetch error:", profileError);
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: { email?: { success: boolean; error?: string }; telegram?: { success: boolean; error?: string } } = {};

    // 2. Send email if enabled
    if (userProfile.notify_email && userProfile.email) {
      results.email = await sendEmail(userProfile.email, alertData);
      await logNotification(
        supabase,
        alertData.alert_id,
        alertData.user_id,
        "email",
        results.email.success ? "sent" : "failed",
        results.email.error
      );
    }

    // 3. Send telegram if enabled
    if (userProfile.notify_telegram && userProfile.telegram_chat_id) {
      results.telegram = await sendTelegram(userProfile.telegram_chat_id, alertData);
      await logNotification(
        supabase,
        alertData.alert_id,
        alertData.user_id,
        "telegram",
        results.telegram.success ? "sent" : "failed",
        results.telegram.error
      );
    }

    // 4. Get admins and notify them too
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminRoles && adminRoles.length > 0) {
      const adminUserIds = adminRoles.map((r) => r.user_id);
      
      const { data: adminProfiles } = await supabase
        .from("profiles")
        .select("email, notify_email, notify_telegram, telegram_chat_id, user_id")
        .in("user_id", adminUserIds)
        .neq("user_id", alertData.user_id); // Don't double-notify if user is admin

      if (adminProfiles) {
        for (const admin of adminProfiles) {
          if (admin.notify_email && admin.email) {
            const emailResult = await sendEmail(admin.email, alertData, true);
            await logNotification(
              supabase,
              alertData.alert_id,
              admin.user_id,
              "email",
              emailResult.success ? "sent" : "failed",
              emailResult.error
            );
          }
          if (admin.notify_telegram && admin.telegram_chat_id) {
            const telegramResult = await sendTelegram(admin.telegram_chat_id, alertData, true);
            await logNotification(
              supabase,
              alertData.alert_id,
              admin.user_id,
              "telegram",
              telegramResult.success ? "sent" : "failed",
              telegramResult.error
            );
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Handler error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
