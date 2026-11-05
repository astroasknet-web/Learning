import { fmtDob, period, type ResumeData } from "./resume-data";
import type { Template } from "./templates";

/**
 * Resume data + template -> safe HTML (port of PHP Studio\Renderer). One renderer serves the live preview, the thumbnails
 * and the print/PDF page; the look comes from CSS classes (public/studio/studio-tpl.css), the structure from the
 * template's format. Everything is escaped here. The output is plain markup with no scripts.
 */
export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const truthy = (s: string): boolean => s !== "" && s !== "0";
const stripScheme = (u: string): string => u.replace(/^https?:\/\/(www\.)?/, "");

type Labels = Record<string, string>;

function labels(t: Template): Labels {
  const l: Labels = {
    summary: "Professional Summary", experience: "Work Experience", education: "Education", skills: "Skills", projects: "Projects",
    certifications: "Certifications", awards: "Awards", publications: "Publications", languages: "Languages",
  };
  const byStructure: Record<string, Labels> = {
    academic: { summary: "Research Profile", experience: "Academic and Professional Appointments", projects: "Research Projects", awards: "Honours, Awards and Grants" },
    executive: { summary: "Executive Summary", awards: "Selected Achievements", certifications: "Affiliations and Certifications" },
    functional: { skills: "Core Competencies", experience: "Work History" },
    hybrid: { skills: "Key Skills" },
    creative: { projects: "Selected Work" },
  };
  const byRegion: Record<string, Labels> = { in: { summary: "Career Objective" }, au_nz: { summary: "Career Summary" }, uk_eu: { summary: "Personal Profile" } };
  return { ...l, ...(byStructure[t.structure] ?? {}), ...(byRegion[t.region ?? ""] ?? {}) };
}

function order(t: Template): string[] {
  switch (t.structure) {
    case "hybrid": return ["summary", "skills", "experience", "education", "projects", "certifications", "awards", "languages", "publications"];
    case "functional": return ["summary", "skills", "awards", "experience", "education", "certifications", "languages", "projects"];
    case "academic": return ["summary", "education", "publications", "experience", "projects", "awards", "certifications", "skills", "languages"];
    case "creative": return ["summary", "projects", "experience", "skills", "education", "certifications", "awards", "languages", "publications"];
    case "executive": return ["summary", "awards", "experience", "education", "certifications", "skills", "languages", "projects", "publications"];
    case "de": return ["experience", "education", "skills", "languages", "certifications", "projects", "awards", "publications"];
    case "jp": return ["education", "experience", "certifications", "skills", "languages", "summary", "awards", "projects", "publications"];
    default: return ["summary", "experience", "education", "skills", "projects", "certifications", "awards", "languages", "publications"];
  }
}

export function html(d: ResumeData, t: Template, thumb = false): string {
  const lab = labels(t);
  const sideKeys = t.style === "sidebar" ? ["skills", "languages", "certifications"] : [];
  let main = "";
  let side = "";
  for (const key of order(t)) {
    const h = section(key, d, t, lab);
    if (h === "") continue;
    if (sideKeys.includes(key)) side += h;
    else main += h;
  }
  const cls = `rs tpl-${t.style} fmt-${t.structure}${t.region ? " rg-" + t.region : ""} paper-${t.paper.toLowerCase()}${thumb ? " is-thumb" : ""}`;
  let out = `<div class="${esc(cls)}" dir="auto">${header(d, t)}`;
  if (t.style === "sidebar") out += `<div class="rs-cols"><aside class="rs-side">${contactBlock(d, t)}${side}</aside><div class="rs-main">${main}</div></div>`;
  else out += main + side;
  return out + "</div>";
}

function contactItems(d: ResumeData): string[] {
  const p = d.personal;
  // PHP built this from an array keyed by value, so identical values collapse into one entry (first position, last label).
  const m = new Map<string, string>();
  for (const [v, k] of [[p.email, "mail"], [p.phone, "tel"], [p.location, "loc"]] as const) m.set(v, k);
  const items: string[] = [];
  for (const [v, k] of m) if (v !== "") items.push(`<span class="rs-c rs-c-${k}">${esc(v)}</span>`);
  for (const l of p.links) items.push(`<a class="rs-c" href="${esc(l.url)}" rel="noopener noreferrer">${esc(l.label !== "" ? l.label : stripScheme(l.url))}</a>`);
  return items;
}

function personalExtras(d: ResumeData, t: Template): string[] {
  const p = d.personal;
  const ok = t.personal;
  const x: string[] = [];
  if (ok.includes("dob") && p.dob !== "") x.push("Date of birth: " + esc(fmtDob(p.dob, t.region)));
  if (ok.includes("nationality") && p.nationality !== "") x.push("Nationality: " + esc(p.nationality));
  if (ok.includes("marital") && p.marital !== "") x.push("Marital status: " + esc(p.marital));
  if (ok.includes("visa") && p.visa !== "") x.push("Visa status: " + esc(p.visa));
  return x;
}

function header(d: ResumeData, t: Template): string {
  const p = d.personal;
  let h = `<header class="rs-head"><div class="rs-name">${esc(p.name !== "" ? p.name : "Your Name")}</div>`;
  if (p.headline !== "") h += `<div class="rs-headline">${esc(p.headline)}</div>`;
  if (t.style !== "sidebar") {
    h += `<div class="rs-contact">${contactItems(d).join('<span class="rs-sep" aria-hidden="true"> | </span>')}</div>`;
    const x = personalExtras(d, t);
    if (x.length) h += `<div class="rs-extras">${x.join(" &nbsp;|&nbsp; ")}</div>`;
  }
  return h + "</header>";
}

function contactBlock(d: ResumeData, t: Template): string {
  const items = contactItems(d);
  const x = personalExtras(d, t);
  if (!items.length && !x.length) return "";
  return `<section class="rs-sec rs-contactblock"><h3>Contact</h3><ul><li>${[...items, ...x].join("</li><li>")}</li></ul></section>`;
}

function bullets(b: string[], max = 99): string {
  const s = b.slice(0, max);
  return s.length ? `<ul class="rs-bul"><li>${s.map(esc).join("</li><li>")}</li></ul>` : "";
}

function section(key: string, d: ResumeData, t: Template, lab: Labels): string {
  const style = t.date_style;
  const title = `<h3>${esc(lab[key])}</h3>`;
  const wrap = (body: string) => `<section class="rs-sec rs-${key}">${title}${body}</section>`;
  switch (key) {
    case "summary":
      return d.summary === "" ? "" : wrap(`<p class="rs-summary">${esc(d.summary)}</p>`);
    case "experience": {
      if (!d.experience.length) return "";
      let b = "";
      for (const e of d.experience) {
        const org = [e.company, e.location].filter(truthy).join(", ");
        const cap = t.structure === "functional" ? 2 : 99;
        const extra = [e.hours !== "" ? "Hours per week: " + esc(e.hours) : "", e.salary !== "" ? "Salary: " + esc(e.salary) : "", e.supervisor !== "" ? "Supervisor: " + esc(e.supervisor) : ""].filter(truthy);
        b += `<div class="rs-item"><div class="rs-role"><b>${esc(e.title)}</b>${org !== "" ? `<span class="rs-org">${esc(org)}</span>` : ""}</div>` +
          `<div class="rs-when">${esc(period(e, style))}</div>` +
          `<div class="rs-body">${bullets(e.bullets, cap)}${t.structure === "us_fed" && extra.length ? `<p class="rs-fed">${extra.join(" &middot; ")}</p>` : ""}</div></div>`;
      }
      return wrap(b);
    }
    case "education": {
      if (!d.education.length) return "";
      let b = "";
      for (const e of d.education) {
        const deg = e.degree + (e.field !== "" && !e.degree.toLowerCase().includes(e.field.toLowerCase()) ? " in " + e.field : "");
        const inst = [e.institution, e.location].filter(truthy).join(", ");
        b += `<div class="rs-item"><div class="rs-role"><b>${esc(deg)}</b>${inst !== "" ? `<span class="rs-org">${esc(inst)}</span>` : ""}</div>` +
          `<div class="rs-when">${esc(e.year)}</div>` +
          (e.score !== "" ? `<div class="rs-body"><p class="rs-score">${t.region === "in" ? "CGPA" : "GPA"}: ${esc(e.score)}</p></div>` : "") + "</div>";
      }
      return wrap(b);
    }
    case "skills":
      if (!d.skills.length) return "";
      if (t.structure === "functional" || t.structure === "hybrid" || t.style === "sidebar") {
        return wrap(`<ul class="rs-skills is-grid"><li>${d.skills.map(esc).join("</li><li>")}</li></ul>`);
      }
      return wrap(`<p class="rs-skilltext">${esc(d.skills.join(", "))}</p>`);
    case "projects": {
      if (!d.projects.length) return "";
      let b = "";
      for (const p of d.projects) {
        b += `<div class="rs-item rs-proj"><div class="rs-role"><b>${esc(p.name)}</b>${p.link !== "" ? `<a class="rs-org" href="${esc(p.link)}" rel="noopener noreferrer">${esc(stripScheme(p.link))}</a>` : ""}</div><div class="rs-body">${bullets(p.bullets)}</div></div>`;
      }
      return wrap(b);
    }
    case "certifications": {
      if (!d.certifications.length) return "";
      const rows = d.certifications.map((c) => `<b>${esc(c.name)}</b>${c.issuer !== "" ? ", " + esc(c.issuer) : ""}${c.year !== "" ? ` <span class="rs-yr">(${esc(c.year)})</span>` : ""}`);
      return wrap(`<ul class="rs-list"><li>${rows.join("</li><li>")}</li></ul>`);
    }
    case "awards":
    case "publications": {
      const v = key === "awards" ? d.awards : d.publications;
      return v.length ? wrap(`<ul class="rs-list"><li>${v.map(esc).join("</li><li>")}</li></ul>`) : "";
    }
    case "languages": {
      if (!d.languages.length) return "";
      const rows = d.languages.map((l) => `<b>${esc(l.name)}</b>${l.level !== "" ? ` <span class="rs-yr">${esc(l.level)}</span>` : ""}`);
      return wrap(`<ul class="rs-list rs-inline"><li>${rows.join("</li><li>")}</li></ul>`);
    }
  }
  return "";
}

/** Advice about how well applicant-tracking systems will read this template and this resume. */
export function atsNotes(d: ResumeData, t: Template): string[] {
  const n: string[] = [];
  if (t.style === "sidebar") n.push("Two columns: some applicant-tracking systems read columns out of order. For strict ATS portals use a single-column template.");
  if (t.style === "bold") n.push("A coloured header band looks striking but is not ideal for strict ATS. Keep a plain version for online portals.");
  if (t.structure === "functional") n.push("Skills-first resumes are viewed with suspicion by some recruiters. Keep your work history clear and dated.");
  if (t.structure === "creative") n.push("Creative layout: great for a portfolio conversation, riskier for automated screening.");
  if (d.personal.email === "" || d.personal.phone === "") n.push("Add both an email address and a phone number so employers can reach you.");
  return n;
}
