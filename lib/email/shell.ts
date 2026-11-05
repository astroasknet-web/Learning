/**
 * Shared branded email shell (light/dark aware, 600px card layout) used across
 * transactional emails — originally built for the contact form, now the base
 * for every "team notification" / "user confirmation" email in the app.
 */
export function getEmailShell(inner: string): string {
  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
        <style>
          :root {
            color-scheme: light dark;
            supported-color-schemes: light dark;
          }

          body {
            margin: 0;
            padding: 0;
            background: #f3f4f6;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }

          .email-bg {
            background: #f3f4f6;
          }

          .container {
            width: 600px;
            max-width: 600px;
          }

          .surface {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 16px;
            overflow: hidden;
          }

          .hero {
            background: linear-gradient(135deg, #ff6b35 0%, #ff8f5c 100%);
          }

          .chip {
            display: inline-block;
            border: 1px solid #e5e7eb;
            border-radius: 999px;
            padding: 6px 10px;
            color: #4b5563;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            background: #ffffff;
          }

          .card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            background: #ffffff;
          }

          .text-primary {
            color: #111827;
          }

          .text-muted {
            color: #4b5563;
          }

          .divider {
            border-top: 1px solid #e5e7eb;
          }

          .cta {
            display: inline-block;
            border-radius: 10px;
            padding: 12px 24px;
            font-weight: 700;
            text-decoration: none;
            background: #ff6b35;
            color: #ffffff !important;
          }

          .mobile-pad {
            padding: 28px;
          }

          @media only screen and (max-width: 620px) {
            .container {
              width: 100% !important;
              max-width: 100% !important;
            }

            .outer-pad {
              padding: 16px !important;
            }

            .mobile-pad {
              padding: 20px !important;
            }

            .hero-title {
              font-size: 22px !important;
              line-height: 1.25 !important;
            }

            .body-text {
              font-size: 15px !important;
              line-height: 1.6 !important;
            }
          }

          @media (prefers-color-scheme: dark) {
            body,
            .email-bg {
              background: #0b0d12 !important;
            }

            .surface {
              background: #111827 !important;
              border-color: #2b3342 !important;
            }

            .card {
              background: #0f172a !important;
              border-color: #2b3342 !important;
            }

            .chip {
              background: #111827 !important;
              border-color: #2b3342 !important;
              color: #c8d0de !important;
            }

            .text-primary {
              color: #f3f4f6 !important;
            }

            .text-muted {
              color: #c8d0de !important;
            }

            .divider {
              border-top-color: #2b3342 !important;
            }

            a {
              color: #ff9d76 !important;
            }
          }
        </style>
      </head>
      <body class="email-bg">
        ${inner}
      </body>
    </html>
  `;
}
