import React from 'react';
import { CVData } from '../../types';
import { ScenicTemplateBase } from './ScenicTemplateBase';

interface TemplateProps {
  data: CVData;
  primaryColor?: string;
}

/** Scenic Angkor Wat "Golden Temple" — Column C */
export const ScenicTemplateC: React.FC<TemplateProps> = ({ data, primaryColor = '#d97706' }) => (
  <ScenicTemplateBase
    data={data}
    primaryColor={primaryColor}
    photoUrl="https://images.unsplash.com/photo-1549463601-da058868e20d?q=80&w=1200&auto=format&fit=crop"
  />
);
