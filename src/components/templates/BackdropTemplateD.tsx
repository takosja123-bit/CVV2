import React from 'react';
import { CVData } from '../../types';
import { BackdropTemplateBase } from './BackdropTemplateBase';

interface TemplateProps {
  data: CVData;
  primaryColor?: string;
}

/** Backdrop Angkor Wat "Faded Peach" — Column D */
export const BackdropTemplateD: React.FC<TemplateProps> = ({ data, primaryColor = '#fb923c' }) => (
  <BackdropTemplateBase
    data={data}
    primaryColor={primaryColor}
    photoUrl="https://images.unsplash.com/photo-1566706546199-a93ba33ce9f7?q=80&w=1400&auto=format&fit=crop"
  />
);
