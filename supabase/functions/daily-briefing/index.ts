import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

// ============ DST GUARD: exactly 11:00 Italian time ============

function getCETOffset(now: Date): number {
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();

  if (month >= 3 && month <= 8) return 2; // Apr-Sep → CEST

  if (month === 2) {
    const lastDay = new Date(Date.UTC(year, 3, 0));
    const lastSunday = lastDay.getUTCDate() - lastDay.getUTCDay();
    const dstStart = new Date(Date.UTC(year, 2, lastSunday, 1));
    return now >= dstStart ? 2 : 1;
  }

  if (month === 9) {
    const lastDay = new Date(Date.UTC(year, 10, 0));
    const lastSunday = lastDay.getUTCDate() - lastDay.getUTCDay();
    const dstEnd = new Date(Date.UTC(year, 9, lastSunday, 1));
    return now >= dstEnd ? 1 : 2;
  }

  return 1;
}

function isItalian11AM(): boolean {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const offset = getCETOffset(now);
  const italianHour = now.getUTCHours() + offset;
  return italianHour === 11 && now.getUTCMinutes() < 10;
}

// ============ EMOJI MAPPING ============

const EMOJI_MAP: Record<string, string> = {
  red: '🔴',
  amber: '🟡',
  orange: '🟠',
  purple: '🟣',
  cyan: '🔵',
  green: '🟢',
};

// ============ INTERFACES ============

interface SnapshotSection {
  title: string;
  emoji: string;
  badge?: string;
  items: string[];
}

interface PortfolioBriefing {
  portfolioName: string;
  sections: SnapshotSection[];
}

// ============ MESSAGE FORMATTING ============

function formatDateIT(): string {
  const now = new Date();
  const months = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  return `${now.getUTCDate()} ${months[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
}

function buildTelegramMessage(briefings: PortfolioBriefing[], userName?: string): string {
  let msg = `📋 *Briefing Pre-Apertura*\n📅 ${formatDateIT()}\n`;
  if (userName) {
    msg += `👤 *${userName}*\n`;
  }

  for (const pb of briefings) {
    msg += `\n📁 *${pb.portfolioName}*\n`;
    for (const section of pb.sections) {
      const emoji = EMOJI_MAP[section.emoji] || '⚪';
      const badge = section.badge ? ` [${section.badge}]` : '';
      msg += `\n${emoji} *${section.title}*${badge}\n`;
      for (const item of section.items) {
        msg += `  ${item}\n`;
      }
    }
  }

  return msg;
}

function buildEmailHTML(briefings: PortfolioBriefing[], userName?: string): string {
  let portfolioRows = '';
  for (const pb of briefings) {
    portfolioRows += `
      <tr>
        <td style="padding: 16px 0 8px 0; font-weight: bold; font-size: 16px; color: #1e40af; border-bottom: 2px solid #dbeafe;">
          📁 ${pb.portfolioName}
        </td>
      </tr>`;
    for (const section of pb.sections) {
      const emoji = EMOJI_MAP[section.emoji] || '⚪';
      const badge = section.badge ? ` <span style="font-size: 12px; color: #6b7280;">[${section.badge}]</span>` : '';
      portfolioRows += `
      <tr>
        <td style="padding: 12px 0 4px 8px; font-weight: bold; font-size: 15px;">
          ${emoji} ${section.title}${badge}
        </td>
      </tr>`;
      for (const item of section.items) {
        portfolioRows += `
      <tr>
        <td style="padding: 2px 0 2px 28px; font-size: 14px; color: #374151;">${item}</td>
      </tr>`;
      }
    }
  }

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1e40af; color: white; padding: 16px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">📋 Briefing Pre-Apertura</h2>
        <p style="margin: 4px 0 0 0; font-size: 14px;">📅 ${formatDateIT()}${userName ? ` — ${userName}` : ''}</p>
      </div>
      <div style="padding: 16px; background: #f9fafb; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
        <table style="width: 100%; border-collapse: collapse;">
          ${portfolioRows}
        </table>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 16px;">
          Generato automaticamente alle 11:00.
        </p>
      </div>
    </div>
  `;
}

// ============ SEND FUNCTIONS ============

async function sendTelegram(chatId: string, text: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
      }
    );
    const result = await response.json();
    if (!result.ok) {
      console.error("Telegram error:", result.description);
      return false;
    }
    return true;
  } catch (e) {
    console.error("Telegram send error:", e);
    return false;
  }
}

async function sendEmail(email: string, subject: string, html: string): Promise<boolean> {
  try {
    await resend.emails.send({
      from: "Portfolio Alerts <noreply@resend.dev>",
      to: [email],
      subject,
      html,
    });
    return true;
  } catch (e) {
    console.error("Email send error:", e);
    return false;
  }
}

// ============ MAIN HANDLER ============

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const force = body?.force === true;

    if (!force && !isItalian11AM()) {
      console.log("Not 11:00 Italian time, skipping briefing");
      return new Response(
        JSON.stringify({ skipped: true, reason: "not_italian_11am" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("Starting daily briefing...");

    // 1. Get users with notifications enabled
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, notify_email, notify_telegram, telegram_chat_id");

    const notifiableUsers = (profiles || []).filter(
      (p: any) => p.notify_telegram || p.notify_email
    );

    console.log(`Found ${notifiableUsers.length} users with notifications enabled`);

    // 2. Get admin users for oversight
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminUserIds = new Set((adminRoles || []).map((r: any) => r.user_id));

    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("user_id, email, full_name, admin_notify_email, admin_notify_telegram, telegram_chat_id")
      .in("user_id", Array.from(adminUserIds));

    const MAX_SNAPSHOT_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours
    let totalSent = 0;

    // 3. Process each notifiable user
    for (const user of notifiableUsers) {
      // Get user's portfolios
      const { data: portfolios } = await supabase
        .from("portfolios")
        .select("id, name")
        .eq("user_id", user.user_id);

      if (!portfolios || portfolios.length === 0) continue;

      const portfolioIds = portfolios.map((p: any) => p.id);

      // Read snapshots from monitoring_snapshot
      const { data: snapshots } = await supabase
        .from("monitoring_snapshot")
        .select("portfolio_id, sections, updated_at")
        .in("portfolio_id", portfolioIds);

      if (!snapshots || snapshots.length === 0) {
        console.log(`No snapshots for user ${user.email}, skipping`);
        continue;
      }

      // Build briefing per portfolio
      const portfolioBriefings: PortfolioBriefing[] = [];
      const now = Date.now();

      for (const portfolio of portfolios) {
        const snapshot = (snapshots as any[]).find((s: any) => s.portfolio_id === portfolio.id);
        if (!snapshot) continue;

        // Check staleness
        const snapshotAge = now - new Date(snapshot.updated_at).getTime();
        if (snapshotAge > MAX_SNAPSHOT_AGE_MS) {
          console.warn(`Snapshot for portfolio "${portfolio.name}" is ${Math.round(snapshotAge / 3600000)}h old, skipping`);
          continue;
        }

        const sections = (snapshot.sections || []) as SnapshotSection[];
        if (sections.length > 0) {
          portfolioBriefings.push({ portfolioName: portfolio.name, sections });
        }
      }

      if (portfolioBriefings.length === 0) {
        console.log(`No items to monitor for user ${user.email}, skipping`);
        continue;
      }

      const userName = user.full_name || user.email;

      // Send to user
      if (user.notify_telegram && user.telegram_chat_id) {
        const msg = buildTelegramMessage(portfolioBriefings);
        const ok = await sendTelegram(user.telegram_chat_id, msg);
        if (ok) totalSent++;
      }

      if (user.notify_email && user.email) {
        const html = buildEmailHTML(portfolioBriefings);
        const ok = await sendEmail(user.email, `📋 Briefing Pre-Apertura — ${formatDateIT()}`, html);
        if (ok) totalSent++;
      }

      // Send to admins
      if (adminProfiles) {
        for (const admin of adminProfiles) {
          if (admin.user_id === user.user_id) continue;

          if (admin.admin_notify_telegram && admin.telegram_chat_id) {
            const msg = buildTelegramMessage(portfolioBriefings, userName);
            await sendTelegram(admin.telegram_chat_id, msg);
          }

          if (admin.admin_notify_email && admin.email) {
            const html = buildEmailHTML(portfolioBriefings, userName);
            await sendEmail(admin.email, `📋 Briefing Pre-Apertura — ${userName} — ${formatDateIT()}`, html);
          }
        }
      }
    }

    console.log(`Daily briefing complete. Sent ${totalSent} notifications.`);

    return new Response(
      JSON.stringify({ success: true, sent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Daily briefing error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
