const blockedTerms = [
  '씨발',
  '시발',
  'ㅅㅂ',
  '병신',
  'ㅂㅅ',
  '개새끼',
  '새끼',
  '좆',
  '죽어',
  '꺼져',
  '년',
  '놈',
];

const phoneNumberPattern = /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export interface ModerationResult {
  ok: boolean;
  message: string;
}

export function validateUserText(fields: Array<{ label: string; value: string }>): ModerationResult {
  for (const field of fields) {
    const value = field.value.trim();

    if (!value) {
      continue;
    }

    const normalizedValue = value.toLowerCase().replace(/\s+/g, '');
    const blockedTerm = blockedTerms.find((term) => normalizedValue.includes(term));

    if (blockedTerm) {
      return {
        ok: false,
        message: `${field.label}에 부적절한 표현이 포함되어 있어요. 표현을 순화해서 다시 작성해주세요.`,
      };
    }

    if (phoneNumberPattern.test(value) || emailPattern.test(value)) {
      return {
        ok: false,
        message: `${field.label}에는 전화번호나 이메일 같은 개인정보를 적지 말아주세요.`,
      };
    }
  }

  return {
    ok: true,
    message: '',
  };
}
