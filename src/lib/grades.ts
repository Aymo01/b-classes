/** Five colour stages: grades 1–4, 5–8, 9–10, first secondary (11) and Tawjihi (12). */
export type Stage = 'stage-1' | 'stage-2' | 'stage-3' | 'stage-4' | 'stage-5';
export type Grade = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export function themeForGrade(grade: number | null): Stage | null {
  if (grade === null || !Number.isInteger(grade) || grade < 1 || grade > 12) return null;
  if (grade <= 4) return 'stage-1';
  if (grade <= 8) return 'stage-2';
  if (grade <= 10) return 'stage-3';
  return grade === 11 ? 'stage-4' : 'stage-5';
}

export const stages: { id: Stage; title: string; range: string; description: string; grades: Grade[]; highlights: string[] }[] = [
  { id: 'stage-1', title: 'بداية صغيرة، أحلام كبيرة', range: 'الصفوف الأول – الرابع', description: 'خطوات أولى مليئة بالفضول والاكتشاف، في عالم تعلّم يناسب الصغار.', grades: [1, 2, 3, 4], highlights: ['تعلّم بالاستكشاف', 'خطوات واضحة', 'تجربة مرحة'] },
  { id: 'stage-2', title: 'فضول اليوم، معرفة الغد', range: 'الصفوف الخامس – الثامن', description: 'مساحة للنمو وبناء المعرفة، بخطوات أكثر تنظيمًا واستقلالية.', grades: [5, 6, 7, 8], highlights: ['تعلّم منظّم', 'مساحة للتركيز', 'أهداف واضحة'] },
  { id: 'stage-3', title: 'فضول اليوم، معرفة الغد', range: 'الصفوف التاسع – العاشر', description: 'مساحة للنمو وبناء المعرفة، بخطوات أكثر تنظيمًا واستقلالية.', grades: [9, 10], highlights: ['تعلّم منظّم', 'مساحة للتركيز', 'أهداف واضحة'] },
  { id: 'stage-4', title: 'طموح أكبر، مستقبل أقرب', range: 'الأول الثانوي', description: 'تجربة أكاديمية هادئة ومركّزة، تواكب طموحك في المرحلة الثانوية.', grades: [11], highlights: ['تركيز أكاديمي', 'رحلة نحو المستقبل', 'تجربة متكاملة'] },
  { id: 'stage-5', title: 'طموح أكبر، مستقبل أقرب', range: 'الثاني الثانوي', description: 'تجربة أكاديمية هادئة ومركّزة، تواكب طموحك في المرحلة الثانوية.', grades: [12], highlights: ['تركيز أكاديمي', 'رحلة نحو المستقبل', 'تجربة متكاملة'] },
];

const labels = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
export function gradeLabel(grade: Grade) {
  return grade === 11 ? 'الأول الثانوي' : grade === 12 ? 'الثاني الثانوي' : `الصف ${labels[grade - 1]}`;
}