import LegalDoc, { type Section } from "@/components/pages/legal/LegalDoc";

const SECTIONS: Section[] = [
  {
    id: "free-trials",
    title: "Free trials",
    blocks: [
      {
        type: "list",
        items: [
          {
            term: "No Payment Details Collected",
            text: "Where GrowQR offers a free trial of a paid plan or feature, the trial is entirely free of charge and GrowQR does not collect or require your card, net-banking, UPI, or other payment details to start or continue the trial. Because no payment instrument is placed on file, no e-mandate or standing instruction is created during a free trial, and Clause 2 (Auto-Renewal and Pre-Debit Notice) does not apply to it.",
          },
          {
            term: "No Automatic Conversion to a Paid Plan",
            text: "A free trial does not automatically convert into a paid subscription. When the trial period ends, access to the trialled paid features simply lapses; GrowQR will not charge you, and cannot charge you, unless and until you separately choose to subscribe and affirmatively provide payment details for that purpose. There is accordingly nothing to cancel and nothing to refund in respect of a free trial, and this Clause 1 is stated for transparency rather than as a refund right.",
          },
          "If GrowQR introduces a different form of trial in the future that does require payment details upfront (for example, a trial requiring card verification with delayed billing), GrowQR will clearly disclose that fact, and the terms of that trial, before you enrol, and Clause 2 of this Policy shall apply to it.",
        ],
      },
    ],
  },
  {
    id: "subscription-cancellation",
    title: "Subscription cancellation",
    blocks: [
      {
        type: "list",
        items: [
          "You may cancel an active subscription at any time through your account settings or by writing to support@growqr.ai. Cancellation takes effect at the end of the then-current billing period; you will continue to have access to the paid features until that date, and no further charges will be collected thereafter.",
          {
            term: "Auto-Renewal and Pre-Debit Notice",
            text: "Recurring subscriptions are processed as e-mandates through GrowQR’s payment aggregator. In accordance with the Reserve Bank of India’s framework for processing e-mandates on recurring transactions, GrowQR (through its payment aggregator) will send you a pre-debit notification at least 24 hours before each recurring charge, and you may cancel the standing instruction at any time before that charge is processed, through your account settings, your bank, or your card issuer, without needing GrowQR’s approval.",
          },
        ],
      },
    ],
  },
  {
    id: "refund-eligibility",
    title: "Refund eligibility: subscriptions and one-time purchases",
    blocks: [
      {
        type: "list",
        items: [
          {
            term: "General Rule",
            text: "Except as set out in this Clause 3, fees already paid for a subscription period that has commenced, or for a one-time purchase that has been delivered (for example, a completed resume review or AI Output already generated), are non-refundable. This reflects that GrowQR’s core AI processing and Agent computation costs are incurred at the point of delivery, not evenly across a billing period.",
          },
          {
            term: "Refunds Where the Service Was Not Delivered as Described",
            text: "You are entitled to a full or partial refund, at GrowQR’s assessment, where: (a) a paid feature was materially unavailable or non-functional for a continuous period exceeding 72 hours after you reported the issue to support@growqr.ai; (b) you were charged in error, including a duplicate charge or a charge after valid cancellation; or (c) GrowQR determines, in its reasonable discretion or as directed by a competent consumer forum, that the service delivered was deficient within the meaning of Section 2(11) of the Consumer Protection Act, 2019.",
          },
          "Refund requests must be submitted within thirty (30) days of the disputed charge. GrowQR will acknowledge a refund request within 3 business days and resolve it within 15 business days, in line with the timelines expected of e-commerce entities under the Consumer Protection (E-Commerce) Rules, 2020.",
          "Approved refunds are issued to the original payment method within 7 to 10 business days, subject to processing times of the relevant bank or payment aggregator, and in accordance with the applicable RBI guidelines on refund processing for digital payments.",
          {
            term: "No Cancellation Fee Asymmetry",
            text: "Consistent with Rule 5 of the Consumer Protection (E-Commerce) Rules, 2020, GrowQR does not impose a cancellation charge on you unless GrowQR bears an equivalent charge if it cancels the relevant order or subscription unilaterally.",
          },
        ],
      },
    ],
  },
  {
    id: "no-refund-on-hiring-outcome",
    title: "No refund on account of employment or hiring outcome",
    blocks: [
      {
        type: "list",
        items: [
          {
            term: "Not a Ground for Refund",
            text: "Because GrowQR does not guarantee any employment, interview, placement, hiring, or salary outcome, the absence of such an outcome is not, by itself, a valid ground for a refund of any fee paid, provided the underlying Agent feature, AI Output, QX-Score, or Coach/Creator session was in fact delivered to you as described.",
          },
          "This Clause does not affect your right to a refund under Clause 3 where the service itself was deficient, unavailable, or not delivered.",
        ],
      },
    ],
  },
  {
    id: "how-to-request",
    title: "How to request a cancellation or refund",
    blocks: [
      {
        type: "para",
        text: "Cancellations can be actioned directly through account settings. To request a refund, write to support@growqr.ai with your account email, the transaction date, and the reason for the request. If you are not satisfied with GrowQR’s response, you may escalate to the Grievance Officer at support@growqr.ai, or, if you are an Individual User, approach the consumer dispute redressal mechanism under the Consumer Protection Act, 2019, including the National Consumer Helpline or the appropriate District Consumer Disputes Redressal Commission.",
      },
    ],
  },
  {
    id: "governing-law",
    title: "Governing law",
    blocks: [
      {
        type: "para",
        text: "This Policy is governed by the laws of India, including the Consumer Protection Act, 2019 and the rules made under it. To raise a dispute about a cancellation or refund, write to support@growqr.ai.",
      },
    ],
  },
];

export default function RefundPage() {
  return (
    <LegalDoc
      title="Refund & Cancellation Policy"
      intro="How subscriptions, free trials, cancellations, and refunds work at GrowQR, including the timelines we hold ourselves to when you raise a request."
      lastUpdated="July 14, 2026"
      governingLaw="Consumer Protection Act, 2019 (India)"
      sections={SECTIONS}
    />
  );
}
