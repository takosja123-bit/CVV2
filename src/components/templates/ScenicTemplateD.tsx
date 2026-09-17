import React from 'react';
import { CVData } from '../../types';
import { ScenicTemplateBase } from './ScenicTemplateBase';

interface TemplateProps {
  data: CVData;
  primaryColor?: string;
}

/** Scenic Angkor Wat "Jungle Ruins" — Column D */
export const ScenicTemplateD: React.FC<TemplateProps> = ({ data, primaryColor = '#15803d' }) => (
  <ScenicTemplateBase
    data={data}
    primaryColor={primaryColor}
    photoUrl="https://images.unsplash.com/photo-1566706546199-a93ba33ce9f7?q=80&w=1200&auto=format&fit=crop"
  />
);
