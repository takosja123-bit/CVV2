import React from 'react';
import { CVData } from '../../types';
import { ScenicTemplateBase } from './ScenicTemplateBase';

interface TemplateProps {
  data: CVData;
  primaryColor?: string;
}

/** Scenic Angkor Wat "Blue Horizon" — Column B */
export const ScenicTemplateB: React.FC<TemplateProps> = ({ data, primaryColor = '#1d4ed8' }) => (
  <ScenicTemplateBase
    data={data}
    primaryColor={primaryColor}
    photoUrl="https://images.unsplash.com/photo-1751054220716-7cf3922e46fa?q=80&w=1200&auto=format&fit=crop"
  />
);
