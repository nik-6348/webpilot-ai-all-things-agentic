import { Injectable } from "@nestjs/common";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  async sendEmail(options: SendEmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL || "WebPilot AI <onboarding@webpilot.ai>";

    if (apiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text || options.subject,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✉️ [Resend Email Sent] To: ${options.to}, ID: ${data.id}`);
          return { success: true, id: data.id };
        } else {
          const errText = await response.text();
          console.warn(`⚠️ [Resend Email Failed] Status ${response.status}: ${errText}`);
          return { success: false, error: errText };
        }
      } catch (err: any) {
        console.error(`❌ [Resend Email Error]:`, err.message || err);
        return { success: false, error: String(err.message || err) };
      }
    }

    // Fallback log output when RESEND_API_KEY is not configured
    console.log(`\n=================== ✉️ SIMULATED RESEND EMAIL ===================`);
    console.log(`TO: ${options.to}`);
    console.log(`SUBJECT: ${options.subject}`);
    console.log(`HTML BODY:\n${options.html}`);
    console.log(`=================================================================\n`);
    return { success: true, id: "simulated-resend-id" };
  }
}
