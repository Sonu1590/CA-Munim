export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="mx-auto max-w-3xl space-y-6 text-sm leading-relaxed text-foreground">
        <div>
          <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: [DATE]</p>
        </div>

        <p>
          This Privacy Policy explains how <strong>CA Munim</strong> ("we", "us", "the Platform") collects, uses,
          stores, and shares information when a Chartered Accountant firm ("Firm", "you") and its staff use the
          Platform to manage clients, compliance tasks, billing, documents, and WhatsApp communications, and when a
          Firm's clients interact with features such as the document upload portal or WhatsApp messages sent on the
          Firm's behalf.
        </p>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Who operates this Platform</h2>
          <p>
            CA Munim is operated by [YOUR LEGAL ENTITY / FIRM NAME], [ADDRESS], India. For any privacy-related
            request or question, contact our Grievance Officer at [GRIEVANCE OFFICER NAME / EMAIL / PHONE].
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Information we collect</h2>
          <p><strong>Account and staff data:</strong> name, email address, phone number, and role, collected when a Firm signs up or adds staff members.</p>
          <p><strong>Client data entered by a Firm:</strong> client names, contact numbers, business/registration details (e.g. PAN, GST), service subscriptions, billing and invoice records, and compliance task history.</p>
          <p><strong>Documents:</strong> files uploaded by a Firm's staff or by a client through a document request link, stored securely against the relevant client record.</p>
          <p><strong>WhatsApp messages:</strong> when a Firm sends a message to a client through the Platform, we process the client's phone number and the message content via the WhatsApp Business Platform (operated by Meta) to deliver it, and we log delivery/read status and any reply the client sends back.</p>
          <p><strong>Technical data:</strong> log and usage data (e.g. login timestamps, device/browser information) needed to operate and secure the Platform.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. How we use this information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To provide the Platform's core features: client management, task tracking, billing, document collection, and WhatsApp reminders.</li>
            <li>To authenticate Firm staff and enforce that each Firm can only access its own data.</li>
            <li>To send WhatsApp messages a Firm has configured or triggered (e.g. deadline reminders, document requests, invoice notices) and to receive client replies.</li>
            <li>To maintain security, prevent abuse, and comply with legal obligations.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Sharing with third-party processors</h2>
          <p>We share data with the following service providers strictly to operate the Platform on our behalf:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Supabase</strong> — database, authentication, and file storage.</li>
            <li><strong>Meta / WhatsApp Business Platform</strong> — delivery of WhatsApp messages and receipt of delivery status and replies. Meta's own policies govern its processing of message data; see Meta's WhatsApp Business Terms and Privacy Policy.</li>
            <li>[ANY OTHER PROVIDERS — e.g. payment gateway, hosting] — [purpose].</li>
          </ul>
          <p>We do not sell personal data to third parties.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Data retention</h2>
          <p>
            We retain Firm and client data for as long as the Firm's account is active, and for a reasonable period
            afterward to comply with applicable record-keeping obligations, after which it is deleted or anonymized
            unless a longer retention period is required by law.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Your rights</h2>
          <p>
            Subject to applicable law (including India's Digital Personal Data Protection Act, 2023), you may
            request access to, correction of, or deletion of personal data we hold about you by contacting the
            Grievance Officer above. A Firm's clients should first raise such requests with the Firm they engaged,
            since the Firm controls what client data is entered into the Platform.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Security</h2>
          <p>
            We use industry-standard safeguards, including row-level access controls that restrict each Firm to its
            own data, encrypted storage, and encrypted transmission, to protect information against unauthorized
            access, alteration, or loss.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Changes to this policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Material changes will be reflected by updating the
            "Last updated" date above.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. Contact us</h2>
          <p>[YOUR SUPPORT EMAIL] — [YOUR SUPPORT PHONE, OPTIONAL]</p>
        </section>
      </div>
    </div>
  );
}
