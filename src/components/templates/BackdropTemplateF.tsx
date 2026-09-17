import React from 'react';
import { CVData } from '../../types';
import { BackdropTemplateBase } from './BackdropTemplateBase';

interface TemplateProps {
  data: CVData;
  primaryColor?: string;
}

/** Backdrop Angkor Wat "Faded Crimson" — Column F */
export const BackdropTemplateF: React.FC<TemplateProps> = ({ data, primaryColor = '#b91c1c' }) => (
  <BackdropTemplateBase
    data={data}
    primaryColor={primaryColor}
    photoUrl="https://images.unsplash.com/photo-1549463601-da058868e20d?q=80&w=1400&auto=format&fit=crop"
  />
);
