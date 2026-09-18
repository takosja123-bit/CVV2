import React from 'react';
import { CVData } from '../../types';
import { BackdropTemplateBase } from './BackdropTemplateBase';

interface TemplateProps {
  data: CVData;
  primaryColor?: string;
}

/** Backdrop Angkor Wat "Faded Blue" — Column B */
export const BackdropTemplateB: React.FC<TemplateProps> = ({ data, primaryColor = '#1d4ed8' }) => (
  <BackdropTemplateBase
    data={data}
    primaryColor={primaryColor}
    photoUrl="https://images.unsplash.com/photo-1751054220716-7cf3922e46fa?q=80&w=1400&auto=format&fit=crop"
  />
);
