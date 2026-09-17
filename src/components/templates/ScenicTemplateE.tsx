import React from 'react';
import { CVData } from '../../types';
import { ScenicTemplateBase } from './ScenicTemplateBase';

interface TemplateProps {
  data: CVData;
  primaryColor?: string;
}

/** Scenic Angkor Wat "Burgundy Stone" — Column E */
export const ScenicTemplateE: React.FC<TemplateProps> = ({ data, primaryColor = '#9f1239' }) => (
  <ScenicTemplateBase
    data={data}
    primaryColor={primaryColor}
    photoUrl="https://images.unsplash.com/photo-1540525080980-b97c4be3c779?q=80&w=1200&auto=format&fit=crop"
  />
);
