/**
 * Legal page content — international SaaS boilerplate tailored to what
 * Sightline actually does (AI visibility scanning, content generation,
 * Supabase-hosted accounts, Polar.sh billing). Update CONTACT_EMAIL and
 * review with counsel before high-stakes markets.
 */

export const CONTACT_EMAIL = "support@sightline.app";
const UPDATED = "January 10, 2026";

export interface LegalDoc {
  slug: string;
  title: string;
  updated: string;
  sections: { heading: string; body: string[] }[];
}

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    title: "Privacy Policy",
    updated: UPDATED,
    sections: [
      {
        heading: "1. Who we are",
        body: [
          `Sightline ("Sightline", "we", "us") provides software that measures and improves how brands appear in answers from AI assistants. This policy explains what personal data we collect, why, and the choices you have. It applies to our website, application and public report pages.`,
        ],
      },
      {
        heading: "2. Data we collect",
        body: [
          `Account data: name, email address and password hash when you create an account (authentication is provided by Supabase).`,
          `Workspace data: the brand, website, industry, market, competitors and prompts you configure, plus the scan results, scores, recommendations and content the platform generates for you.`,
          `Billing data: subscription status and plan. Payments are processed by Polar.sh; we never receive or store your full card details.`,
          `Usage data: log and device information (IP address, browser type, pages viewed) used for security and to improve the product.`,
        ],
      },
      {
        heading: "3. How we use data",
        body: [
          `To provide the service: running scans, computing visibility scores, generating recommendations and content, and sending the reports and digests you request.`,
          `To operate the business: billing, support, service announcements and abuse prevention.`,
          `We do not sell personal data, and we do not use your workspace data to train AI models.`,
        ],
      },
      {
        heading: "4. AI processing",
        body: [
          `Scans send your configured prompts (which may include your brand and competitor names) to third-party AI model providers to observe their answers. Content generation sends your workspace context to an AI provider to draft the material you request. These providers process the data as our subprocessors under their own terms.`,
        ],
      },
      {
        heading: "5. Sharing",
        body: [
          `We share data only with the service providers needed to run Sightline (hosting, database and authentication, AI model access, email delivery, payments), with workspace members you invite, and through public report links you deliberately create. Public report pages show your scores and recommendations to anyone with the link until you revoke it.`,
        ],
      },
      {
        heading: "6. International transfers",
        body: [
          `We serve customers globally and our providers may process data in the United States, the European Union and other regions. Where required, transfers rely on appropriate safeguards such as standard contractual clauses maintained by our providers.`,
        ],
      },
      {
        heading: "7. Retention and deletion",
        body: [
          `Workspace data is retained while your account is active. Deleting a workspace removes its scans, results and generated content. Deleting your account removes your profile and all workspaces you own. Backups expire on a rolling basis within a limited window.`,
        ],
      },
      {
        heading: "8. Your rights",
        body: [
          `Depending on your location (including under the GDPR and CCPA), you may have rights to access, correct, export, restrict or delete your personal data, and to object to certain processing. Contact us at ${CONTACT_EMAIL} and we will respond within the timeframe required by applicable law. You may also lodge a complaint with your local supervisory authority.`,
        ],
      },
      {
        heading: "9. Security",
        body: [
          `Data is encrypted in transit, access is scoped per account with row-level security, and administrative access is restricted. No method of storage is perfectly secure; notify us immediately at ${CONTACT_EMAIL} if you suspect unauthorized access.`,
        ],
      },
      {
        heading: "10. Changes and contact",
        body: [
          `We will post any material changes to this policy here and, where appropriate, notify you by email. Questions: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    slug: "terms",
    title: "Terms of Service",
    updated: UPDATED,
    sections: [
      {
        heading: "1. Agreement",
        body: [
          `These Terms govern your use of Sightline. By creating an account or using the service you accept them. If you use Sightline on behalf of a company, you confirm you are authorized to bind that company.`,
        ],
      },
      {
        heading: "2. The service",
        body: [
          `Sightline measures how AI assistants describe your brand, benchmarks competitors, tracks search demand and generates optimization content. Scores and results are observations of third-party AI systems at a point in time; those systems change constantly and results are provided for guidance, not as a guarantee of any commercial outcome.`,
        ],
      },
      {
        heading: "3. Accounts and workspaces",
        body: [
          `You are responsible for your credentials, for the accuracy of the information you configure, and for the actions of teammates you invite to your workspaces. Each plan defines limits (workspaces, prompts, scans, seats) that we enforce automatically.`,
        ],
      },
      {
        heading: "4. Subscriptions and billing",
        body: [
          `Paid plans are billed through Polar.sh on the cycle shown at checkout and renew automatically until cancelled. Cancelling stops future renewals; your plan remains active until the end of the paid period. Lifetime plans are one-time purchases governed by the limits stated at purchase. Taxes may be added where required. See the Refund Policy for refunds.`,
        ],
      },
      {
        heading: "5. Acceptable use",
        body: [
          `Use of the service must comply with our Acceptable Use Policy, which is part of these Terms.`,
        ],
      },
      {
        heading: "6. Content",
        body: [
          `You retain all rights to the data you provide and to the content Sightline generates for you, and you are responsible for reviewing generated content for accuracy and legality before publishing it. We retain all rights to the Sightline software and branding. Public report pages you create may carry Sightline attribution.`,
        ],
      },
      {
        heading: "7. Disclaimers",
        body: [
          `The service is provided "as is" and "as available" without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose and non-infringement. We do not control third-party AI systems and do not warrant that your visibility will improve.`,
        ],
      },
      {
        heading: "8. Limitation of liability",
        body: [
          `To the maximum extent permitted by law, our aggregate liability arising out of the service is limited to the amounts you paid us in the twelve months before the claim, and we are not liable for indirect, incidental, special, consequential or punitive damages, or lost profits, revenue or data.`,
        ],
      },
      {
        heading: "9. Termination",
        body: [
          `You may stop using the service and delete your account at any time. We may suspend or terminate accounts that materially breach these Terms; where practical we will notify you first.`,
        ],
      },
      {
        heading: "10. General",
        body: [
          `We may update these Terms with reasonable notice for material changes; continued use after the effective date constitutes acceptance. If any provision is unenforceable, the remainder stays in effect. Contact: ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    updated: UPDATED,
    sections: [
      {
        heading: "1. What cookies we use",
        body: [
          `Sightline uses a small set of first-party cookies that are strictly necessary to run the product: authentication session cookies (so you stay signed in) and preference cookies such as your active workspace selection.`,
        ],
      },
      {
        heading: "2. What we do not use",
        body: [
          `We do not use advertising cookies and we do not run third-party ad trackers. If we introduce analytics cookies in the future, we will update this policy and request consent where the law requires it.`,
        ],
      },
      {
        heading: "3. Managing cookies",
        body: [
          `You can delete or block cookies in your browser settings. Because our cookies are essential, blocking them will prevent sign-in and core functionality from working.`,
        ],
      },
      {
        heading: "4. Contact",
        body: [`Questions about this policy: ${CONTACT_EMAIL}.`],
      },
    ],
  },
  {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    updated: UPDATED,
    sections: [
      {
        heading: "1. Purpose",
        body: [
          `This policy keeps Sightline safe and useful for everyone. It applies to all use of the service and forms part of the Terms of Service.`,
        ],
      },
      {
        heading: "2. You may not",
        body: [
          `Use the service to violate any law, infringe intellectual property, or process data you have no right to process.`,
          `Track brands or configure prompts for the purpose of harassment, defamation or deceptive comparison.`,
          `Publish generated content that is knowingly false or misleading, including fabricated reviews or endorsements.`,
          `Probe, disrupt or overload the service, circumvent plan limits or rate limits, scrape other customers' data, or resell access without our written agreement.`,
          `Upload malicious code or use the service to distribute spam.`,
        ],
      },
      {
        heading: "3. Fair use of scans and generation",
        body: [
          `Scan and content-generation quotas exist to keep the service fast and economical for all customers. Automated attempts to exceed them may be throttled or blocked.`,
        ],
      },
      {
        heading: "4. Enforcement",
        body: [
          `We may remove content, suspend features or terminate accounts that breach this policy, with notice where practical. Report abuse to ${CONTACT_EMAIL}.`,
        ],
      },
    ],
  },
  {
    slug: "refunds",
    title: "Refund Policy",
    updated: UPDATED,
    sections: [
      {
        heading: "1. Monthly and annual subscriptions",
        body: [
          `If Sightline isn't right for you, contact us within 14 days of your first payment for a full refund — no questions asked. Renewal payments are generally non-refundable, but if you cancel within 72 hours of an annual renewal and have not materially used the service since, we will refund that renewal.`,
        ],
      },
      {
        heading: "2. Lifetime deals",
        body: [
          `Lifetime plans purchased through partners such as AppSumo follow the partner's refund policy and timeline; refund requests should be made through the marketplace where you purchased.`,
        ],
      },
      {
        heading: "3. How refunds are processed",
        body: [
          `Approved refunds are returned to the original payment method via our payment provider (Polar.sh), normally within 5–10 business days. Statutory rights that cannot be waived in your jurisdiction, including EU/UK consumer withdrawal rights, remain unaffected.`,
        ],
      },
      {
        heading: "4. Contact",
        body: [`Request a refund or ask a question: ${CONTACT_EMAIL}.`],
      },
    ],
  },
];
