import { createServerFn } from '@tanstack/react-start';

type Input = { topic: string; grade: string | null };

export const generateStudyGuidance = createServerFn({ method: 'POST' })
  .inputValidator((data: Input) => {
    const topic = String(data?.topic ?? '').trim().slice(0, 1500);
    if (topic.length < 5) throw new Error('اكتب وصفًا أوضح للموضوع أو التحدي.');
    return { topic, grade: data?.grade ? String(data.grade).slice(0, 60) : null };
  })
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return { ok: false as const, error: 'خدمة الإرشاد غير مهيأة حاليًا.' };

    const res = await fetch('https://ai.gateway.lovable.dev/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Lovable-API-Key': key, 'X-Lovable-AIG-SDK': 'fetch' },
      body: JSON.stringify({
        model: 'openai/gpt-6-astra',
        stream: true,
        store: false,
        reasoning: { effort: 'low' },
        instructions:
          'أنت مرشد دراسي لطلاب منصة B classes. أجب بالعربية الفصحى المبسطة وبما يناسب صف الطالب. قدّم إرشادًا عمليًا قابلًا للتنفيذ بهذا الترتيب وبعناوين قصيرة: "فهم التحدي" (جملتان)، "خطة العمل" (3-5 خطوات مرقّمة محددة)، "تمرين سريع" (نشاط واحد قصير)، "نصيحة للتركيز". لا تخترع دروسًا أو درجات أو بيانات عن الطالب. استخدم نصًا عاديًا بلا رموز Markdown مثل ** أو #.',
        input: `الصف: ${data.grade ?? 'غير محدد'}\nوصف الطالب: ${data.topic}`,
      }),
    });

    if (!res.ok || !res.body) {
      const msg =
        res.status === 429 ? 'الطلبات كثيرة الآن، حاول بعد قليل.' :
        res.status === 402 ? 'رصيد الذكاء الاصطناعي غير كافٍ حاليًا.' :
        'تعذّر إنشاء الإرشاد، حاول مرة أخرى.';
      console.error('AI gateway error', res.status, await res.text().catch(() => ''));
      return { ok: false as const, error: msg };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === 'response.output_text.delta') text += evt.delta ?? '';
          if (evt.type === 'error' || evt.type === 'response.failed') {
            return { ok: false as const, error: 'تعذّر إنشاء الإرشاد، حاول مرة أخرى.' };
          }
        } catch { /* ignore partial */ }
      }
    }
    if (!text.trim()) return { ok: false as const, error: 'لم يصل رد، جرّب صياغة أخرى.' };
    return { ok: true as const, guidance: text.trim() };
  });
