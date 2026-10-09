export type Stage = 'elementary' | 'middle' | 'secondary';
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export function themeForGrade(grade: number | null): Stage | null {
  if (grade === null || !Number.isInteger(grade) || grade < 1 || grade > 12) return null;
  if (grade <= 4) return 'elementary';
  if (grade <= 10) return 'middle';
  return 'secondary';
}

export const stages: { id: Stage; title: string; range: string; description: string; grades: Grade[]; highlights: string[] }[] = [
  { id: 'elementary', title: 'بداية صغيرة، أحلام كبيرة', range: 'الصفوف الأول – الرابع', description: 'خطوات أولى مليئة بالفضول والاكتشاف، في عالم تعلّم يناسب الصغار.', grades: [1, 2, 3, 4], highlights: ['تعلّم بالاستكشاف', 'خطوات واضحة', 'تجربة مرحة'] },
  { id: 'middle', title: 'فضول اليوم، معرفة الغد', range: 'الصفوف الخامس – العاشر', description: 'مساحة للنمو وبناء المعرفة، بخطوات أكثر تنظيمًا واستقلالية.', grades: [5, 6, 7, 8, 9, 10], highlights: ['تعلّم منظّم', 'مساحة للتركيز', 'أهداف واضحة'] },
  { id: 'secondary', title: 'طموح أكبر، مستقبل أقرب', range: 'الأول والثاني الثانوي', description: 'تجربة أكاديمية هادئة ومركّزة، تواكب طموحك في المرحلة الثانوية.', grades: [11, 12], highlights: ['تركيز أكاديمي', 'رحلة نحو المستقبل', 'تجربة متكاملة'] },
];

const labels = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
export function gradeLabel(grade: Grade) {
  return grade === 11 ? 'الأول الثانوي' : grade === 12 ? 'الثاني الثانوي' : `الصف ${labels[grade - 1]}`;
}