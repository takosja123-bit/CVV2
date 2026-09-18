import React from 'react';
import { CVData } from '../../types';
import { Mail, Phone, MapPin, Globe, Github, Linkedin, LucideIcon } from 'lucide-react';
import { getSkillLevel, getLanguageLevel } from './TemplateHelpers';

export interface ScenicTemplateProps {
  data: CVData;
  primaryColor?: string;
  /** Full-bleed scenic background photo for the left panel (e.g. an Unsplash CDN URL). */
  photoUrl: string;
}

const ContactRow: React.FC<{ icon: LucideIcon; text: string }> = ({ icon: Icon, text }) => (
  <div className="flex items-center gap-2">
    <span className="w-5 h-5 rounded-full bg-white/30 border border-white/30 flex items-center justify-center shrink-0">
      <Icon className="w-2.5 h-2.5 text-white" />
    </span>
    <span className="text-[9.5px] text-white/95 leading-tight break-all drop-shadow-sm">
      {text}
    </span>
  </div>
);

/**
 * Shared "scenic" resume layout: a full-bleed background photograph on the
 * left third (with a tinted overlay in the template's accent color so the
 * name / title / contact details stay legible), and a clean, near-opaque
 * content panel on the right holding the standard CV sections. Individual
 * template files (ScenicTemplateB..H) are thin wrappers around this
 * component that just supply a different `primaryColor` and `photoUrl`.
 */
export const ScenicTemplateBase: React.FC<ScenicTemplateProps> = ({
  data,
  primaryColor = '#1e3a5f',
  photoUrl,
}) => {
  const { personal, experiences, education, skills, languages, achievements, references } = data;

  return (
    <div className="relative w-full min-h-full overflow-hidden rounded-sm shadow-sm font-sans-ui text-slate-800 flex text-[11px]">
      {/* Left: scenic photo panel */}
      <div
        className="relative w-[30%] shrink-0 flex flex-col"
        style={{
          backgroundImage: `url(${photoUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(175deg, ${primaryColor}d9 0%, ${primaryColor}99 40%, ${primaryColor}40 75%, ${primaryColor}b3 100%)`,
          }}
        />

        <div className="relative z-10 p-5 flex flex-col h-full">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight drop-shadow">
              {personal.fullName || 'John Doe'}
            </h1>
            <p className="text-[9.5px] font-semibold uppercase tracking-widest mt-1.5 text-white/90 drop-shadow">
              {personal.jobTitle || 'Software Engineer'}
            </p>
          </div>

          <div className="mt-6 space-y-2.5">
            {personal.phone && <ContactRow icon={Phone} text={personal.phone} />}
            {personal.email && <ContactRow icon={Mail} text={personal.email} />}
            {personal.address && <ContactRow icon={MapPin} text={personal.address} />}
            {personal.website && <ContactRow icon={Globe} text={personal.website} />}
            {personal.linkedin && <ContactRow icon={Linkedin} text={personal.linkedin} />}
            {personal.github && <ContactRow icon={Github} text={personal.github} />}
          </div>

          {/* Skills tucked into the photo panel, like small chips over the scenery */}
          {skills && skills.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="text-[9px] font-bold uppercase tracking-widest text-white/80 border-b border-white/25 pb-1">
                Skills
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s, i) => {
                  const { name } = getSkillLevel(s);
                  return (
                    <span
                      key={i}
                      className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-white/25 border border-white/30 text-white"
                    >
                      {name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {languages && languages.length > 0 && (
            <div className="mt-4 space-y-2">
              <h3 className="text-[9px] font-bold uppercase tracking-widest text-white/80 border-b border-white/25 pb-1">
                Languages
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {languages.map((l, i) => {
                  const { name } = getLanguageLevel(l);
                  return (
                    <span
                      key={i}
                      className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-white/25 border border-white/30 text-white"
                    >
                      {name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex-1" />
        </div>
      </div>

      {/* Right: content panel */}
      <div className="w-[70%] bg-white/[.98] p-7 flex flex-col gap-4">
        {/* PROFILE */}
        {personal.summary && (
          <section className="space-y-1.5">
            <h2
              className="text-[11px] font-bold uppercase tracking-widest pb-1 border-b-2"
              style={{ color: primaryColor, borderColor: primaryColor }}
            >
              Profile
            </h2>
            <p className="text-[10px] leading-relaxed text-slate-600 text-justify">
              {personal.summary}
            </p>
          </section>
        )}

        {/* WORK EXPERIENCE */}
        {experiences && experiences.length > 0 && (
          <section className="space-y-2">
            <h2
              className="text-[11px] font-bold uppercase tracking-widest pb-1 border-b-2"
              style={{ color: primaryColor, borderColor: primaryColor }}
            >
              Work Experience
            </h2>
            <div className="space-y-3">
              {experiences.map((exp) => (
                <div key={exp.id} className="space-y-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-[11px] text-slate-900">{exp.jobTitle}</span>
                    <span className="text-[9px] text-slate-500 font-medium whitespace-nowrap">
                      {exp.startDate} – {exp.current ? 'Present' : exp.endDate}
                    </span>
                  </div>
                  <div className="text-[10px] font-semibold" style={{ color: primaryColor }}>
                    {exp.company}
                    {exp.location ? ` • ${exp.location}` : ''}
                  </div>
                  {exp.bullets && exp.bullets.length > 0 && (
                    <ul className="list-disc ml-3.5 text-[9.5px] text-slate-600 space-y-0.5 pt-0.5">
                      {exp.bullets.map((b, i) => (
                        <li key={i} className="leading-snug">
                          {b}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* EDUCATION */}
        {education && education.length > 0 && (
          <section className="space-y-2">
            <h2
              className="text-[11px] font-bold uppercase tracking-widest pb-1 border-b-2"
              style={{ color: primaryColor, borderColor: primaryColor }}
            >
              Education
            </h2>
            <div className="space-y-2">
              {education.map((edu) => (
                <div key={edu.id} className="space-y-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold text-[10.5px] text-slate-900">{edu.institution}</span>
                    <span className="text-[9px] text-slate-500 font-medium whitespace-nowrap">
                      {edu.endDate}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-700">{edu.degree}</div>
                  {edu.details && (
                    <p className="text-[9.5px] text-slate-500 leading-snug">{edu.details}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ACHIEVEMENTS & REFERENCES */}
        <div className="grid grid-cols-2 gap-5 pt-1">
          {achievements && achievements.length > 0 && (
            <section className="space-y-1.5">
              <h2
                className="text-[11px] font-bold uppercase tracking-widest pb-1 border-b-2"
                style={{ color: primaryColor, borderColor: primaryColor }}
              >
                Achievements
              </h2>
              {achievements.map((ach) => (
                <div key={ach.id} className="text-[9.5px]">
                  <div className="font-bold text-slate-900">{ach.title}</div>
                  <p className="text-slate-600 leading-snug">{ach.description}</p>
                </div>
              ))}
            </section>
          )}

          {references && references.length > 0 && (
            <section className="space-y-1.5">
              <h2
                className="text-[11px] font-bold uppercase tracking-widest pb-1 border-b-2"
                style={{ color: primaryColor, borderColor: primaryColor }}
              >
                References
              </h2>
              {references.map((ref) => (
                <div key={ref.id} className="text-[9.5px]">
                  <div className="font-bold text-slate-900">{ref.name}</div>
                  <div className="text-slate-600">
                    {ref.title}
                    {ref.company ? ` • ${ref.company}` : ''}
                  </div>
                  {ref.email && <div className="text-slate-500">{ref.email}</div>}
                  {ref.phone && <div className="text-slate-500">{ref.phone}</div>}
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
