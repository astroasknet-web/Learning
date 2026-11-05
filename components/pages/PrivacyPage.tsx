import LegalDoc, { type Section } from "@/components/pages/legal/LegalDoc";

const SECTIONS: Section[] = [
  {
    id: "who-we-are-and-scope",
    title: "Who we are and scope",
    blocks: [
      {
        type: "para",
        text: "GrowQR operates globally, headquartered at 103 Carnegie Center Drive, Princeton, NJ 08540, USA, with an operating office at 4th Floor, Wesource Building, Plot No. 8, Sector 125, Noida, Uttar Pradesh 201313, India. Where you are located in India, or GrowQR offers the Services to you in India, GrowQR acts as a “Data Fiduciary” and you as a “Data Principal” under the Digital Personal Data Protection Act, 2023 (“DPDP Act”), which applies to this processing regardless of where GrowQR’s servers are located, by operation of Section 3(b) of the DPDP Act.",
      },
    ],
  },
  {
    id: "personal-data-we-collect",
    title: "Personal data we collect",
    blocks: [
      {
        type: "list",
        items: [
          {
            term: "Identity and account data",
            text: "name, email, phone number, date of birth (for age verification), password, and account preferences.",
          },
          {
            term: "Profile and career data",
            text: "resumes, work history, education, skills, career preferences, onboarding responses, and publicly available profile information you explicitly ask GrowQR to import (for example, from a connected professional network).",
          },
          {
            term: "Interview and roleplay recordings",
            text: "audio and video captured during practice sessions with an Agent, which may contain your voice and facial characteristics.",
          },
          {
            term: "Derived and inferred data",
            text: "your QX-Score, skill-gap analyses, and other outputs GrowQR’s Agents generate from the data above.",
          },
          {
            term: "Agent activity data",
            text: "records of Autonomous Actions taken on your behalf (for example, job applications submitted or content published), and your authorisation settings for each Agent.",
          },
          {
            term: "Credential data",
            text: "records underlying any Verified Credential, together with the associated reference recorded on a distributed ledger.",
          },
          {
            term: "Payment data",
            text: "transaction records; card and bank details are collected and stored directly by our payment processor, not by GrowQR.",
          },
          {
            term: "Usage and device data",
            text: "session activity, log data, device and browser information, and approximate location, collected automatically through cookies and similar technologies.",
          },
          {
            term: "Organisation User data",
            text: "where you use the Services on behalf of an enterprise, recruiter, startup, or institute, your business contact details and the searches, shortlists, and communications you conduct through the Services.",
          },
        ],
      },
    ],
  },
  {
    id: "how-and-why-we-use-personal-data",
    title: "How and why we use personal data",
    blocks: [
      {
        type: "para",
        text: "GrowQR processes Personal Data for the following purposes, on the basis of your consent given at onboarding or at first use of the relevant feature, or another valid ground for processing recognised under the DPDP Act:",
      },
      {
        type: "list",
        items: [
          "to create and administer your account and provide the Services you request, including Agent-generated recommendations and AI Output;",
          "to calculate your QX-Score and generate Verified Credentials;",
          "to enable Autonomous Actions you have specifically authorised, such as publishing content to an account you have connected;",
          "to make your profile discoverable to Organisation Users where you have chosen to make it visible;",
          "to facilitate Coach bookings and process related payments;",
          "to communicate with you, including service updates and, where you have separately opted in, marketing communications;",
          "to maintain security, detect fraud or misuse, and comply with legal obligations;",
          "to improve GrowQR’s own proprietary AI systems, using de-identified or aggregated data, unless you opt out by writing to support@growqr.ai.",
        ],
      },
      {
        type: "para",
        text: "GrowQR does not use your Personal Data to train publicly available third-party foundation AI models.",
      },
    ],
  },
  {
    id: "connected-social-accounts",
    title: "Connected social accounts",
    blocks: [
      {
        type: "para",
        text: "GrowQR connects to Instagram and to LinkedIn only when you explicitly authorise it, through each platform’s own authorisation screen. GrowQR requests the following permissions and nothing beyond them. Each one is listed here with the exact data or capability it grants.",
      },
      {
        type: "list",
        items: [
          {
            term: "Instagram, instagram_business_basic",
            text: "the Instagram professional account you connect, including its account ID, username, account type, profile picture, follower count and media count, together with the media on that account, including each item’s media type, permalink, timestamp, and like and comment counts.",
          },
          {
            term: "Instagram, instagram_business_content_publish",
            text: "permission to create and publish posts to the connected account. GrowQR publishes only content you have approved, or content released on a posting schedule you configured and can change or pause at any time.",
          },
          {
            term: "Instagram, instagram_business_manage_insights",
            text: "the performance metrics Instagram reports for the connected account and its media, which GrowQR uses to produce the performance reporting you see in the product.",
          },
          {
            term: "LinkedIn, Sign In with LinkedIn using OpenID Connect",
            text: "your LinkedIn name, headline, profile picture and primary email address, used to identify your LinkedIn account and populate your GrowQR profile.",
          },
          {
            term: "LinkedIn, Share on LinkedIn",
            text: "permission to publish posts to your LinkedIn feed on your behalf, under the same approval and scheduling controls that apply to Instagram.",
          },
        ],
      },
      {
        type: "para",
        text: "GrowQR does not read your Instagram direct messages or comments, does not access any account you have not connected, does not use connected account data for advertising, and does not sell it. GrowQR does not use connected account data to train publicly available third-party foundation AI models. GrowQR does not integrate with Facebook and requests no Facebook Page or Facebook profile data.",
      },
      {
        type: "para",
        text: "For each connected account GrowQR stores the access token issued by the platform for as long as the connection is active, together with the data described above and a record of the posts it has published on your behalf. Disconnecting the account in GrowQR, or revoking GrowQR’s access from within Instagram or LinkedIn, stops all further access immediately.",
      },
      {
        type: "link",
        prefix: "To have the data GrowQR holds for a connected account deleted, follow the instructions on the",
        href: "/data-deletion",
        label: "Data Deletion page",
        suffix: ".",
      },
    ],
  },
  {
    id: "eligibility-and-account-registration",
    title: "Eligibility and account registration",
    blocks: [
      {
        type: "list",
        items: [
          "You must be at least eighteen (18) years of age, or the age of majority in your jurisdiction of residence, and possess the legal capacity to contract under Section 11 of the Indian Contract Act, 1872, to register for or use the Services.",
          "You represent and warrant that all information you provide during registration and thereafter is true, accurate, current, and complete, and you undertake to promptly update such information if it changes.",
          "You are solely responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account. You must notify GrowQR immediately at support@growqr.ai upon becoming aware of any unauthorised use of your account or breach of security.",
          "Accounts are personal and non-transferable. You may not create an account on behalf of another person without authorisation, share your account credentials, or sell, rent, or otherwise transfer your account to any third party.",
          "GrowQR reserves the right to refuse registration, or to suspend or terminate an existing account, where it reasonably believes the information provided is false, misleading, or in breach of the terms on which the Services are offered.",
        ],
      },
    ],
  },
  {
    id: "how-we-share-personal-data",
    title: "How we share personal data",
    blocks: [
      {
        type: "list",
        items: [
          {
            term: "Third-Party Providers",
            text: "GrowQR shares Personal Data with AI, cloud-hosting, analytics, and payment vendors strictly as needed to provide the Services, under contractual terms requiring them to protect the data and use it only for the purposes GrowQR specifies.",
          },
          {
            term: "Organisation Users",
            text: "Profile data, QX-Scores, and Verified Credentials are shared with an Organisation User only where you have made the relevant element visible or have applied to that Organisation User’s posted opportunity.",
          },
          {
            term: "Coaches",
            text: "Where you book a session, GrowQR shares the information necessary for that session (such as your name and the topic of the session) with the relevant Coach.",
          },
          {
            term: "Legal and safety disclosures",
            text: "GrowQR may disclose Personal Data where required by law, court order, or a lawful direction of a government authority, or to protect the rights, safety, or property of GrowQR, its Users, or the public.",
          },
          "GrowQR does not sell Personal Data.",
        ],
      },
    ],
  },
  {
    id: "cross-border-data-transfer",
    title: "Cross-border data transfer",
    blocks: [
      {
        type: "para",
        text: "Because GrowQR operates internationally, with its headquarters in the United States and infrastructure and Third-Party Providers that may be located in other countries, your Personal Data may be transferred to, stored, and processed in jurisdictions outside India. GrowQR transfers Personal Data outside India only to countries not restricted by the Central Government under the DPDP Act, and requires recipients to apply data-protection standards consistent with the DPDP Act through contractual or comparable safeguards.",
      },
    ],
  },
  {
    id: "data-retention-and-deletion",
    title: "Data retention and deletion",
    blocks: [
      {
        type: "list",
        items: [
          "GrowQR retains Personal Data for as long as your account is active and for a reasonable period thereafter to comply with legal obligations, resolve disputes, and enforce agreements, after which it is deleted or anonymised.",
          "Interview and roleplay recordings are retained only for the period necessary to deliver feedback and improve the relevant Agent, or such longer period as you elect, and may be deleted by you at any time through account settings.",
          "Where Personal Data underlies a Verified Credential anchored to a distributed ledger, GrowQR will delete the off-chain record upon a valid erasure request and, where technically supported, revoke the on-chain reference. A reference already written to a distributed ledger cannot itself be erased.",
        ],
      },
      {
        type: "link",
        prefix: "To request deletion of your data, including data from a connected Instagram or LinkedIn account, follow the instructions on the",
        href: "/data-deletion",
        label: "Data Deletion page",
        suffix: ".",
      },
    ],
  },
  {
    id: "your-rights-as-a-data-principal",
    title: "Your rights as a data principal",
    blocks: [
      {
        type: "para",
        text: "Subject to the DPDP Act and its rules, you have the right to:",
      },
      {
        type: "list",
        items: [
          "obtain a summary of the Personal Data GrowQR holds about you and the processing activities undertaken;",
          "seek correction, completion, updating, and erasure of your Personal Data;",
          "withdraw consent at any time, without affecting the lawfulness of processing before withdrawal;",
          "nominate another individual to exercise these rights on your behalf in the event of your death or incapacity;",
          "obtain an explanation of the principal factors contributing to your QX-Score and dispute an inaccurate factor;",
          "lodge a grievance with GrowQR’s Grievance Officer, and thereafter with the Data Protection Board of India.",
        ],
      },
      {
        type: "contact",
        prefix: "To exercise these rights, write to",
        suffix: ". GrowQR will respond within the timelines prescribed under the DPDP Act.",
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    blocks: [
      {
        type: "para",
        text: "GrowQR applies administrative, technical, and physical safeguards, including access controls and encryption in transit, to protect Personal Data, consistent with the reasonable security practices contemplated under Section 43A of the Information Technology Act, 2000 and the Information Technology (Reasonable Security Practices and Sensitive Personal Data or Information) Rules, 2011. No method of transmission or storage is completely secure, and GrowQR cannot guarantee absolute security.",
      },
      {
        type: "para",
        text: "In the event of a Personal Data breach, GrowQR will take remedial measures and provide notifications to the extent and within the timelines required under the DPDP Act.",
      },
    ],
  },
  {
    id: "cookies-and-similar-technologies",
    title: "Cookies and similar technologies",
    blocks: [
      {
        type: "para",
        text: "GrowQR uses cookies and similar technologies to operate the Services, remember your preferences, and understand usage patterns. You can control cookies through your browser settings; disabling certain cookies may affect the functionality of the Services.",
      },
    ],
  },
  {
    id: "changes-to-this-policy",
    title: "Changes to this policy",
    blocks: [
      {
        type: "para",
        text: "GrowQR may update this Privacy Policy to reflect technological, legal, or operational changes. Material changes will be notified in-app or by email at least fifteen (15) days before taking effect, except where a shorter period is required by Applicable Law. Continued use of the Services after that date constitutes acceptance of the updated Policy.",
      },
    ],
  },
  {
    id: "contact-and-grievance-redressal",
    title: "Contact and grievance redressal",
    blocks: [
      {
        type: "details",
        rows: [
          { label: "Grievance Officer", value: "GrowQR Private Limited" },
          { label: "Email", value: "support@growqr.ai", email: true },
          { label: "General Contact", value: "support@growqr.ai", email: true },
          {
            label: "Delhi NCR Office",
            value: "4th Floor, Wesource Building, Plot No. 8, Sector 125, Noida, Uttar Pradesh 201313",
          },
        ],
      },
    ],
  },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      intro="How GrowQR collects, uses, and protects your personal data, written to comply with India's Digital Personal Data Protection Act, 2023."
      lastUpdated="August 26, 2026"
      governingLaw="DPDP Act, 2023 (India)"
      sections={SECTIONS}
    />
  );
}
