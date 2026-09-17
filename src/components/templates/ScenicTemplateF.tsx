import React from 'react';
import { CVData } from '../../types';
import { ScenicTemplateBase } from './ScenicTemplateBase';

interface TemplateProps {
  data: CVData;
  primaryColor?: string;
}

/** Scenic Angkor Wat "Charcoal Ruins" — Column F */
export const ScenicTemplateF: React.FC<TemplateProps> = ({ data, primaryColor = '#1f2937' }) => (
  <ScenicTemplateBase
    data={data}
    primaryColor={primaryColor}
    photoUrl="https://images.unsplash.com/photo-1500209690208-15084dbf0c57?q=80&w=1200&auto=format&fit=crop"
  />
);
