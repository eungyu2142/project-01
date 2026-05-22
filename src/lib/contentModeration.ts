const blockedTerms = [
  '씨발',
  '시발',
  '병신',
  '미친',
  '개새끼',
  '꺼져',
  '죽어',
  '좆',
  '존나',
  '염병',
  '지랄',
  '새끼',
];

const phoneNumberPattern = /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/;
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

export interface ModerationResult {
  ok: boolean;
  message: string;
}

function success(): ModerationResult {
  return {
    ok: true,
    message: '',
  };
}

function validatePrivateInfo(fields: Array<{ label: string; value: string }>): ModerationResult {
  for (const field of fields) {
    const value = field.value.trim();

    if (!value) {
      continue;
    }

    if (phoneNumberPattern.test(value) || emailPattern.test(value)) {
      return {
        ok: false,
        message: `${field.label}전화번호나 이메일 같은 개인정보를 적지 말아주세요.`,
      };
    }
  }

  return success();
}

export function validateReviewText(fields: Array<{ label: string; value: string }>): ModerationResult {
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
        message: `${field.label}부적절한 표현이 포함되어 있어요. 표현을 순화해서 다시 작성해주세요.`,
      };
    }
  }

  return validatePrivateInfo(fields);
}

export function validateMedicalRecordText(
  fields: Array<{ label: string; value: string }>,
): ModerationResult {
  return validatePrivateInfo(fields);
}

export const validateUserText = validateReviewText;
