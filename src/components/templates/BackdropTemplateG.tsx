import React from 'react';
import { CVData } from '../../types';
import { BackdropTemplateBase } from './BackdropTemplateBase';

interface TemplateProps {
  data: CVData;
  primaryColor?: string;
}

/** Backdrop Angkor Wat "Faded Gold" — Column G */
export const BackdropTemplateG: React.FC<TemplateProps> = ({ data, primaryColor = '#ca8a04' }) => (
  <BackdropTemplateBase
    data={data}
    primaryColor={primaryColor}
    photoUrl="https://images.unsplash.com/photo-1644651434676-c1937ecad149?q=80&w=1400&auto=format&fit=crop"
  />
);
