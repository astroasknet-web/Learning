/**
 * Old PHP address -> new Next.js address, so every link ever shared (emails, QR codes, bookmarks, Google) keeps working after the cut-over.
 * Permanent (308). Query strings are carried over by Next, so `login.php?next=/x` and `reset-password.php?token=T` need no special rule.
 * Pages whose id/slug moved from the query string into the path use a `has` capture.
 */
type Redirect = { source: string; destination: string; permanent: true; has?: Array<{ type: "query"; key: string; value: string }> };

const plain: Array<[string, string]> = [
  ["/index.php", "/"], ["/login.php", "/login"], ["/login-mfa.php", "/login/mfa"], ["/signup.php", "/signup"], ["/forgot-password.php", "/forgot-password"], ["/reset-password.php", "/reset-password"],
  ["/verify-email.php", "/verify-email"], ["/mfa-setup.php", "/account/mfa"], ["/student-dashboard.php", "/account"],
  ["/employer-dashboard.php", "/employer"], ["/employer-post.php", "/employer/post"],
  ["/internships.php", "/internships"], ["/my-courses.php", "/my-courses"], ["/courses.php", "/courses"],
  ["/study-abroad.php", "/study-abroad"], ["/abroad-dashboard.php", "/abroad"], ["/abroad-profile.php", "/abroad/profile"], ["/abroad-matches.php", "/abroad/matches"], ["/abroad-documents.php", "/abroad/documents"],
  ["/abroad-visa.php", "/abroad/visa"], ["/abroad-funds.php", "/abroad/funds"], ["/abroad-loans.php", "/abroad/loans"], ["/abroad-interview.php", "/abroad/interview"],
  ["/studio.php", "/studio"], ["/studio-export.php", "/studio/export"],
  ["/resume-score.php", "/resume-score"], ["/score.php", "/resume-score"], ["/tracker.php", "/resume-score"], ["/qr.php", "/passport/qr"],
  ["/passport.php", "/passport"], ["/passport-share.php", "/passport/share"], ["/verify.php", "/verify"],
  ["/admin.php", "/console"], ["/admin-colleges.php", "/console/colleges"], ["/admin-studio.php", "/console/studio"], ["/admin-abroad.php", "/console/abroad"], ["/admin-analytics.php", "/console/analytics"],
  ["/counselor-dashboard.php", "/counselor"],
  ["/crm.php", "/crm"], ["/crm-leads.php", "/crm/leads"], ["/crm-reports.php", "/crm/reports"], ["/crm-team.php", "/crm/team"],
];

/** [old page, query key, pattern for its value, new path with :key] */
const byQuery: Array<[string, string, string, string]> = [
  ["/internship.php", "s", "[a-z0-9-]+", "/internships/:s"],
  ["/course.php", "s", "[a-z0-9-]+", "/courses/:s"],
  ["/university.php", "s", "[a-z0-9-]+", "/universities/:s"],
  ["/study-abroad-country.php", "c", "[a-z]+", "/study-abroad/:c"],
  ["/v.php", "c", "[A-Za-z0-9]+", "/v/:c"],
  ["/studio-edit.php", "id", "[0-9]+", "/studio/edit/:id"],
  ["/resume.php", "id", "[0-9]+", "/employer/resume/:id"],
  ["/crm-lead.php", "id", "[0-9]+", "/crm/leads/:id"],
  ["/crm-doc.php", "id", "[0-9]+", "/crm/doc/:id"],
  ["/crm-file.php", "t", "[a-f0-9]{32}", "/file/:t"],
  ["/abroad-doc.php", "id", "[0-9]+", "/abroad/doc/:id"],
  ["/counselor-student.php", "id", "[0-9]+", "/counselor/student/:id"],
  ["/counselor-mock.php", "id", "[0-9]+", "/counselor/mock/:id"],
];

export function legacyRedirects(): Redirect[] {
  return [
    ...byQuery.map(([source, key, pat, destination]): Redirect => ({ source, destination, permanent: true, has: [{ type: "query", key, value: `(?<${key}>${pat})` }] })),
    ...plain.map(([source, destination]): Redirect => ({ source, destination, permanent: true })),
  ];
}
