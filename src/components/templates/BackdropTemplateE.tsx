import React from 'react';
import { CVData } from '../../types';
import { BackdropTemplateBase } from './BackdropTemplateBase';

interface TemplateProps {
  data: CVData;
  primaryColor?: string;
}

/** Backdrop Angkor Wat "Faded Red" — Column E */
export const BackdropTemplateE: React.FC<TemplateProps> = ({ data, primaryColor = '#dc2626' }) => (
  <BackdropTemplateBase
    data={data}
    primaryColor={primaryColor}
    photoUrl="https://images.unsplash.com/photo-1540525080980-b97c4be3c779?q=80&w=1400&auto=format&fit=crop"
  />
);
