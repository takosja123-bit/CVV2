import React from 'react';
import { CVData } from '../../types';
import {
  Mail,
  Phone,
  MapPin,
  Globe,
  Github,
  Linkedin,
  User,
  Briefcase,
  GraduationCap,
  Award,
  Users,
} from 'lucide-react';
import {
  DefaultAvatar,
  SkillItemRow,
  getLanguageLevel,
  SkillMeter,
  formatSectionTitle,
} from './TemplateHelpers';

export interface BackdropTemplateProps {
  data: CVData;
  primaryColor?: string;
  /** Faint full-page watermark photo shown behind the whole resume. */
  photoUrl: string;
}

/**
 * Shared "backdrop" resume layout: a very faint, desaturated full-page
 * photograph sits behind the whole page as a watermark, with a plain
 * (banner-free) header — avatar, name, job title, contact row — followed
 * by a two-column body (Profile/Skills/Languages/References on the left,
 * Work Experience/Education/Achievements on the right). Individual
 * template files (BackdropTemplateB..H) are thin wrappers that just supply
 * a different `primaryColor` accent.
 */
export const BackdropTemplateBase: React.FC<BackdropTemplateProps> = ({
  data,
  primaryColor = '#1d4ed8',
  photoUrl,
}) => {
  const { personal, experiences, education, skills, languages, achievements, references, style } = data;
  const showIcons = style?.showIcons !== false && style?.showSectionIcons !== false;
  const isUppercase = style?.uppercaseHeaders !== false;

  const SectionHeader: React.FC<{ icon: React.ElementType; title: string }> = ({ icon: Icon, title }) => (
    <div
      className="flex items-center gap-1.5 pb-1 border-b"
      style={{ color: primaryColor, borderColor: `${primaryColor}55` }}
    >
      {showIcons && <Icon className="w-3.5 h-3.5 shrink-0" />}
      <h2 className="font-bold text-[11px] tracking-wider">{formatSectionTitle(title, isUppercase)}</h2>
    </div>
  );

  return (
    <div className="relative w-full min-h-full overflow-hidden font-sans-ui text-slate-800 text-[11px] leading-snug bg-white">
      {/* Faint full-page background watermark */}
      <div className="absolute inset-0 z-0">
        <img
          src={photoUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-[0.16] grayscale-[0.2]"
        />
        <div className="absolute inset-0 bg-white/55" />
      </div>

      <div className="relative z-10 p-7 space-y-5">
        {/* Header (banner-free) */}
        <div className="flex items-center gap-4 pb-3 border-b-2" style={{ borderColor: primaryColor }}>
          <DefaultAvatar photoUrl={personal.photoUrl} fullName={personal.fullName} sizeClass="w-16 h-16" borderColor="border-white" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight" style={{ color: primaryColor }}>
              {personal.fullName || 'John Doe'}
            </h1>
            <p
              className="text-[10px] font-semibold uppercase tracking-widest mt-0.5"
              style={{ color: primaryColor, opacity: 0.75 }}
            >
              {personal.jobTitle || 'Software Engineer'}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[9.5px] text-slate-600 mt-2">
              {personal.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" style={{ color: primaryColor }} />
                  {personal.phone}
                </span>
              )}
              {personal.email && (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" style={{ color: primaryColor }} />
                  {personal.email}
                </span>
              )}
              {personal.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" style={{ color: primaryColor }} />
                  {personal.address}
                </span>
              )}
              {personal.website && (
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" style={{ color: primaryColor }} />
                  {personal.website}
                </span>
              )}
              {personal.linkedin && (
                <span className="flex items-center gap-1">
                  <Linkedin className="w-3 h-3" style={{ color: primaryColor }} />
                  {personal.linkedin}
                </span>
              )}
              {personal.github && (
                <span className="flex items-center gap-1">
                  <Github className="w-3 h-3" style={{ color: primaryColor }} />
                  {personal.github}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left column */}
          <div className="col-span-5 space-y-5">
            {personal.summary && (
              <div className="space-y-1.5">
                <SectionHeader icon={User} title="Profile" />
                <p className="text-[10px] text-slate-600 leading-relaxed text-justify">{personal.summary}</p>
              </div>
            )}

            {skills && skills.length > 0 && (
              <div className="space-y-2">
                <SectionHeader icon={Award} title="Skills" />
                <div className={data.skillStyle === 'tags' ? 'flex flex-wrap gap-1.5 pt-1' : 'grid grid-cols-1 gap-2'}>
                  {skills.map((item, idx) => (
                    <SkillItemRow key={idx} item={item} style={data.skillStyle || 'segmented'} primaryColor={primaryColor} />
                  ))}
                </div>
              </div>
            )}

            {languages && languages.length > 0 && (
              <div className="space-y-2">
                <SectionHeader icon={Globe} title="Languages" />
                <div className="space-y-2">
                  {languages.map((lang, idx) => {
                    const { name, level } = getLanguageLevel(lang);
                    return (
                      <div key={idx} className="flex items-center justify-between text-[10px]">
                        <span className="font-medium text-slate-700">{name}</span>
                        <SkillMeter level={level} style={data.skillStyle === 'tags' ? 'segmented' : (data.skillStyle || 'segmented')} activeColor={primaryColor} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {references && references.length > 0 && (
              <div className="space-y-2">
                <SectionHeader icon={Users} title="References" />
                <div className="space-y-2 text-[9.5px]">
                  {references.map((ref) => (
                    <div key={ref.id} className="space-y-0.5">
                      <div className="font-bold text-slate-900">{ref.name}</div>
                      <div className="text-slate-600">
                        {ref.title}
                        {ref.company ? ` • ${ref.company}` : ''}
                      </div>
                      {ref.email && <div className="text-slate-500 truncate">Email: {ref.email}</div>}
                      {ref.phone && <div className="text-slate-500">Phone: {ref.phone}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="col-span-7 space-y-5">
            {experiences && experiences.length > 0 && (
              <div className="space-y-3">
                <SectionHeader icon={Briefcase} title="Work Experience" />
                <div className="space-y-3">
                  {experiences.map((exp) => (
                    <div key={exp.id} className="relative pl-3 border-l-2" style={{ borderColor: `${primaryColor}40` }}>
                      <div className="flex items-baseline justify-between text-[10.5px] gap-2">
                        <span className="font-bold text-slate-900">{exp.jobTitle}</span>
                        <span className="text-[9px] text-slate-500 font-medium whitespace-nowrap">
                          {exp.startDate} - {exp.current ? 'Present' : exp.endDate}
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
              </div>
            )}

            {education && education.length > 0 && (
              <div className="space-y-3">
                <SectionHeader icon={GraduationCap} title="Education" />
                <div className="space-y-3">
                  {education.map((edu) => (
                    <div key={edu.id} className="relative pl-3 border-l-2" style={{ borderColor: `${primaryColor}40` }}>
                      <div className="flex items-baseline justify-between text-[10.5px] gap-2">
                        <span className="font-bold text-slate-900">{edu.institution}</span>
                        <span className="text-[9px] text-slate-500 font-medium whitespace-nowrap">
                          {edu.startDate ? `${edu.startDate} - ` : ''}
                          {edu.endDate}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-700">{edu.degree}</div>
                      {edu.details && <p className="text-[9.5px] text-slate-500 italic leading-snug">{edu.details}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {achievements && achievements.length > 0 && (
              <div className="space-y-2.5">
                <SectionHeader icon={Award} title="Achievements" />
                <div className="space-y-2.5">
                  {achievements.map((ach) => (
                    <div key={ach.id} className="text-[10px] space-y-0.5">
                      <div className="font-bold text-slate-800">{ach.title}</div>
                      <div className="text-[9px] text-slate-500 italic">{ach.date}</div>
                      <p className="text-slate-600 leading-snug">{ach.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
