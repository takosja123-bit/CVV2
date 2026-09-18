import React from 'react';
import { CVData } from '../../types';
import { BackdropTemplateBase } from './BackdropTemplateBase';

interface TemplateProps {
  data: CVData;
  primaryColor?: string;
}

/** Backdrop Angkor Wat "Faded Green" — Column H */
export const BackdropTemplateH: React.FC<TemplateProps> = ({ data, primaryColor = '#16a34a' }) => (
  <BackdropTemplateBase
    data={data}
    primaryColor={primaryColor}
    photoUrl="https://images.unsplash.com/photo-1653959864991-c828b72c82a8?q=80&w=1400&auto=format&fit=crop"
  />
);
